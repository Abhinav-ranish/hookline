import { z } from "zod";

export const hookSchema = z.object({
  spoken: z.string(),
  onScreenText: z.string(),
  firstFrame: z.string(),
  archetype: z.string(),
  payoffPromise: z.string(),
});

export const beatSchema = z.object({
  kind: z.enum(["proof", "point", "turn", "payoff", "ending"]),
  spoken: z.string(),
  direction: z.string(),
});

export const querySchema = z.object({
  hashtags: z.array(z.string()),
  keywords: z.array(z.string()),
});

export const viewKindSchema = z.enum(["shot_list", "hooks", "evidence", "checklist"]);

export const routerSchema = z.object({
  intent: z.enum(["new_script", "revise", "view", "chat"]),
  view: z.enum(["shot_list", "hooks", "evidence", "checklist", "none"]),
  topic: z.string(),
  instruction: z.string(),
  reply: z.string(),
});

export const questionSchema = z.object({ question: z.string(), options: z.array(z.string()) });

export const briefSchema = z.object({
  ready: z.boolean(),
  topic: z.string(),
  audience: z.string(),
  space: z.string(),
  angle: z.string(),
  intro: z.string(),
  questions: z.array(questionSchema),
  rememberAudience: z.string(),
  rememberSpace: z.string(),
});

export const groundingSchema = z.object({
  audience: z.string(),
  angles: z.array(z.object({ angle: z.string(), whyNow: z.string(), postIds: z.array(z.string()) })),
  hookPatterns: z.array(z.object({ pattern: z.string(), postIds: z.array(z.string()) })),
  claims: z.array(z.object({ claim: z.string(), postIds: z.array(z.string()) })),
  saturated: z.array(z.string()),
  gap: z.string(),
});

export const hookBatchSchema = z.object({ hooks: z.array(hookSchema) });

export const criticSchema = z.object({
  ratings: z.array(
    z.object({
      index: z.number().int(),
      coldClarity: z.number().int(),
      gap: z.number().int(),
      stakes: z.number().int(),
      mouthfeel: z.number().int(),
      deliverable: z.number().int(),
      freshness: z.number().int(),
      note: z.string(),
    }),
  ),
});

export const draftSchema = z.object({
  title: z.string(),
  beats: z.array(beatSchema),
  caption: z.string(),
  factsToCheck: z.array(z.string()),
});

export const revisionSchema = z.object({
  title: z.string(),
  hook: hookSchema,
  beats: z.array(beatSchema),
  caption: z.string(),
  factsToCheck: z.array(z.string()),
  changeSummary: z.string(),
});

export const sourceSchema = z.object({
  id: z.string(),
  platform: z.enum(["instagram", "tiktok"]),
  url: z.string(),
  author: z.string(),
  views: z.number().nullable(),
  ageDays: z.number().nullable(),
  opening: z.string(),
  openingIsSpoken: z.boolean(),
});

export const trendInfoSchema = z.object({
  status: z.enum(["live", "cached", "none"]),
  fetchedAt: z.string().nullable(),
  scanned: z.number(),
  note: z.string(),
});

export const scriptSchema = z.object({
  title: z.string(),
  topic: z.string(),
  durationSec: z.number(),
  hook: hookSchema,
  beats: z.array(beatSchema),
  caption: z.string(),
  alternates: z.array(hookSchema),
  sources: z.array(sourceSchema),
  flags: z.array(z.string()),
  trend: trendInfoSchema,
  grounding: groundingSchema.nullable(),
  corpus: z.string(),
});

export type ViewKind = z.infer<typeof viewKindSchema>;
export type Hook = z.infer<typeof hookSchema>;
export type Beat = z.infer<typeof beatSchema>;
export type Question = z.infer<typeof questionSchema>;
export type Brief = z.infer<typeof briefSchema>;
export type Grounding = z.infer<typeof groundingSchema>;
export type Script = z.infer<typeof scriptSchema>;
export type Source = z.infer<typeof sourceSchema>;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  script: Script | null;
  questions: Question[] | null;
  view: { kind: ViewKind; scriptMessageId: string } | null;
  createdAt: string;
};

export type Conversation = { id: string; title: string; updatedAt: string };

export type StreamEvent =
  | { type: "conversation"; id: string; title: string }
  | { type: "user"; message: ChatMessage }
  | { type: "stage"; label: string; detail?: string }
  | { type: "assistant"; message: ChatMessage }
  | { type: "error"; message: string };
