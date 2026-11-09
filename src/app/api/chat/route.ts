import { z } from "zod";
import { addMessage, conversationExists, createConversation, getMessage, getSetting, latestScript, listMessages, setSetting } from "@/lib/db";
import { generate } from "@/lib/llm";
import { assessBrief, createScript, rememberInNotes, reviseScript, swapHook, type Emit } from "@/lib/pipeline";
import { routerSchema, viewKindSchema, type ChatMessage, type Question, type Script, type StreamEvent, type ViewKind } from "@/lib/schemas";
import { VIEW_TITLES } from "@/lib/views";

export const dynamic = "force-dynamic";

const MAX_BRIEF_ROUNDS = 2;

const bodySchema = z.object({
  conversationId: z.string().nullable(),
  text: z.string().trim().min(1).max(4000),
  durationSec: z.number().int().min(15).max(180).default(45),
  refresh: z.boolean().default(false),
  skipBrief: z.boolean().default(false),
  useTrends: z.boolean().default(true),
  swap: z.object({ messageId: z.string(), hookIndex: z.number().int().min(0) }).nullable().default(null),
  view: z.object({ kind: viewKindSchema, messageId: z.string() }).nullable().default(null),
});

async function route(text: string, current: Script | null, history: string) {
  return generate({
    tier: "fast",
    name: "route",
    schema: routerSchema,
    system: `You route messages in a reel-script writing chat.
new_script: the user names a topic or asks for a script on a different subject.
revise: the user wants a change to the current script, such as shorter, funnier, or a different ending.
view: the user wants the current script's information presented differently, without changing it. Set "view" to shot_list (shots, timing, filming plan, timeline), hooks (compare or see the hook options), evidence (why it works, trends, sources, what it was based on), or checklist (what to do before and during filming).
chat: anything else, like a question about the script, a greeting, or an unclear message. Put a short helpful reply in "reply".
"topic" is the subject for new_script, written as a clear search-ready phrase. "instruction" restates the edit for revise. Unused text fields are empty strings, and "view" is "none" unless intent is view.`,
    user: `Current script: ${current ? `"${current.title}" about ${current.topic}. Hook: ${current.hook.spoken}` : "none yet"}\n\nRecent messages:\n${history || "none"}\n\nNew message: ${text}`,
  });
}

/** Walks back over an unfinished briefing, returning its turns and how many rounds were asked. */
function briefingSoFar(messages: ChatMessage[]) {
  const turns: string[] = [];
  let rounds = 0;
  let i = messages.length - 1;
  while (i >= 1 && messages[i].role === "assistant" && messages[i].questions?.length && messages[i - 1].role === "user") {
    const asked = messages[i].questions!.map((q) => q.question).join(" ");
    turns.unshift(`Creator: ${messages[i - 1].content}`, `Producer: ${asked}`);
    rounds++;
    i -= 2;
  }
  return { turns, rounds };
}

type Result = { script: Script | null; content: string; questions?: Question[]; view?: ChatMessage["view"] };

const showView = (kind: ViewKind, scriptMessageId: string): Result => ({ script: null, content: VIEW_TITLES[kind], view: { kind, scriptMessageId } });

async function startScript(opts: { text: string; prior: ChatMessage[]; durationSec: number; refresh: boolean; skipBrief: boolean; useTrends: boolean; emit: Emit }): Promise<Result> {
  const { text, prior, durationSec, refresh, skipBrief, useTrends, emit } = opts;
  const { turns, rounds } = briefingSoFar(prior);
  const exchange = [...turns, `Creator: ${text}`].join("\n");
  let notes = await getSetting("notes");

  emit("Checking the brief");
  const brief = await assessBrief(exchange, notes, skipBrief || rounds >= MAX_BRIEF_ROUNDS);
  if (!brief.ready && brief.questions.length) return { script: null, content: brief.intro || "Quick question before I write this.", questions: brief.questions };

  const updated = rememberInNotes(rememberInNotes(notes, "Audience", brief.rememberAudience), "Space", brief.rememberSpace);
  if (updated !== notes) await setSetting("notes", updated);
  notes = updated;

  const context = [brief.audience && `Audience for this video: ${brief.audience}`, brief.space && `Space: ${brief.space}`, brief.angle && `Angle: ${brief.angle}`].filter(Boolean).join("\n");
  return createScript({ topic: brief.topic || text, message: exchange, durationSec, notes: [notes, context].filter(Boolean).join("\n"), refresh, useTrends, emit });
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { text, durationSec, refresh, skipBrief, useTrends, swap, view } = parsed.data;

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };
      const emit: Emit = (label, detail) => send({ type: "stage", label, detail });
      // Apify waits can run a minute or more without an event. This keeps the connection visibly alive.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode("\n"));
        } catch {
          closed = true;
        }
      }, 15_000);

      try {
        let conversationId = parsed.data.conversationId;
        if (!conversationId || !(await conversationExists(conversationId))) {
          const conversation = await createConversation(text.length > 60 ? `${text.slice(0, 60).replace(/\s+\S*$/, "")}…` : text);
          conversationId = conversation.id;
          send({ type: "conversation", id: conversation.id, title: conversation.title });
        }
        const prior = await listMessages(conversationId);
        send({ type: "user", message: await addMessage(conversationId, "user", text) });

        const current = await latestScript(conversationId);
        const briefing = Boolean(prior.at(-1)?.questions?.length);
        let result: Result;

        if (swap) {
          const target = (await getMessage(swap.messageId))?.script;
          if (!target) throw new Error("That script no longer exists.");
          result = await swapHook(target, swap.hookIndex, await getSetting("notes"), emit);
        } else if (view) {
          if (!(await getMessage(view.messageId))?.script) throw new Error("That script no longer exists.");
          result = showView(view.kind, view.messageId);
        } else if (briefing || skipBrief) {
          result = await startScript({ text, prior, durationSec, refresh, skipBrief, useTrends, emit });
        } else {
          emit("Reading your message");
          const history = prior.slice(-6).map((m) => `${m.role}: ${m.content.slice(0, 300)}`).join("\n");
          const decision = await route(text, current?.script ?? null, history);
          if (decision.intent === "new_script") {
            result = await startScript({ text, prior, durationSec, refresh, skipBrief, useTrends, emit });
          } else if (decision.intent === "view" && decision.view !== "none" && current) {
            result = showView(decision.view, current.messageId);
          } else if (decision.intent === "revise" && current) {
            result = await reviseScript(current.script, decision.instruction || text, await getSetting("notes"), emit);
          } else {
            result = { script: null, content: decision.reply || "Give me a topic and I'll write the script." };
          }
        }
        // The chat can be deleted during a long generation. There is nowhere left to save the reply.
        if (await conversationExists(conversationId)) {
          send({ type: "assistant", message: await addMessage(conversationId, "assistant", result.content, result.script, result.questions ?? null, result.view ?? null) });
        }
      } catch (error) {
        console.error("[chat]", error);
        send({ type: "error", message: error instanceof Error ? error.message : "Something went wrong." });
      }
      clearInterval(heartbeat);
      if (!closed) controller.close();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
