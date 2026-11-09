import { generate } from "./llm";
import { apifyEnabled, collectTrends, type TrendResult } from "./apify";
import { ageInDays, type TrendPost } from "./trends";
import { BODY_PLAYBOOK, ENDING_PLAYBOOK, HOOK_PLAYBOOK, TRUTH_RULES, VOICE_RULES, wordBudget } from "./playbook";
import { countWords, lintHook, lintScript } from "./lint";
import {
  briefSchema,
  criticSchema,
  draftSchema,
  groundingSchema,
  hookBatchSchema,
  querySchema,
  revisionSchema,
  type Beat,
  type Brief,
  type Grounding,
  type Hook,
  type Script,
  type Source,
} from "./schemas";

export type Emit = (label: string, detail?: string) => void;

const creator = (notes: string) => (notes.trim() ? `CREATOR NOTES (the only source of first-person experience):\n${notes.trim()}` : "CREATOR NOTES: none supplied. Do not write any first-person experience.");

/** Decides whether enough is known to write a script that fits this creator, or what to ask first. */
export async function assessBrief(exchange: string, notes: string, mustProceed: boolean): Promise<Brief> {
  const brief = await generate({
    tier: "fast",
    name: "brief",
    schema: briefSchema,
    system: `You are a short-form producer taking a quick brief before writing a reel script.
Two things are crucial: who the audience is, and what space or niche the creator is in. A hook aimed at nobody in particular is weak.
Set ready true when both are stated or can be confidently inferred from the conversation or creator notes. A specific request such as "skincare for new moms" already implies them.
Otherwise set ready false and ask only about what is truly missing and would change the hook.
- At most 2 questions, one short sentence each, with 3 or 4 short tappable options specific to the topic.
- Never ask about video length, tone, platform, or anything already answered.
- "intro" is one short, friendly sentence before the questions. Empty when ready.
Always fill "topic" with a clear search-ready phrase from the latest request. Fill audience, space and angle with what is known, or empty strings.
rememberAudience and rememberSpace: only what the creator said about their usual audience and space, ready to store for future videos. Empty if inferred or specific to this one video.`,
    user: `${notes.trim() ? `Creator notes:\n${notes.trim()}` : "Creator notes: none yet"}\n\nConversation:\n${exchange}${mustProceed ? "\n\nThe creator wants to proceed now. Set ready to true and make your best assumptions." : ""}`,
  });
  return mustProceed ? { ...brief, ready: true, questions: [] } : { ...brief, questions: brief.questions.slice(0, 2) };
}

/** Adds a labelled line to the creator notes unless that label is already there. */
export function rememberInNotes(notes: string, label: string, value: string) {
  if (!value.trim() || new RegExp(`^${label}:`, "im").test(notes)) return notes;
  return `${notes.trim()}\n${label}: ${value.trim()}`.trim();
}

async function buildQueries(topic: string) {
  const result = await generate({
    tier: "fast",
    name: "search_queries",
    schema: querySchema,
    system: "You turn a video topic into social media searches that find what creators are posting about it right now.",
    user: `Topic: ${topic}\n\nReturn 3 Instagram/TikTok hashtags without the # (one word, lowercase, actively used, specific rather than huge generic tags) and 2 natural keyword searches a viewer would type.`,
  });
  return {
    hashtags: result.hashtags.map((h) => h.replace(/[^\p{L}\p{N}_]/gu, "").toLowerCase()).filter(Boolean).slice(0, 3),
    keywords: result.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 2),
  };
}

const describePost = (post: TrendPost, now: number) => {
  const age = ageInDays(post.postedAt, now);
  const stats = [
    `${post.views ?? "unknown"} views`,
    `${post.shares ?? "unknown"} shares`,
    `${post.saves ?? "unknown"} saves`,
    `${age === null ? "unknown" : Math.round(age)} days old`,
  ].join(", ");
  const opening = post.spokenOpening ? `SPOKEN OPENING: ${post.spokenOpening}` : "SPOKEN OPENING: not available";
  return `[${post.id}] ${post.platform} @${post.author} (${stats})\n${opening}\nCAPTION: ${post.caption.slice(0, 500)}`;
};

async function ground(topic: string, trends: TrendResult, notes: string): Promise<Grounding> {
  const now = Date.now();
  return generate({
    tier: "hook",
    name: "trend_brief",
    schema: groundingSchema,
    system: `You are a short-form video analyst. You read ranked scraped posts and report only what they show.
Ignore posts that are off-topic, spam, not in the topic's language, or pure reposts.
Posts are ranked by views for their age and share rate. This shows what is popular now, not proven growth.
Captions are not spoken hooks. Derive hook patterns from SPOKEN OPENING lines. For hook patterns only, a high-performing post in an adjacent niche still counts, because a spoken structure transfers across topics. Use caption structure only if there are no usable spoken openings.
Every item must cite real post ids from the list. Hook patterns must be abstract structures with no words of the topic and no quoted text.
Claims are what creators are saying. They are unverified leads. Include only specific, checkable ones.
Angles and the gap are ideas about the topic itself, written for the viewer's benefit. Never describe what other videos do or omit, and never put post ids in those text fields.`,
    user: `Topic: ${topic}\n${creator(notes)}\n\nPosts:\n\n${trends.posts.map((p) => describePost(p, now)).join("\n\n")}\n\nReturn: the likely audience; 2 to 4 angles getting traction and why now; 2 to 5 hook patterns; useful claims; angles that are already saturated; and the gap: one sentence stating a fresh, specific idea about the topic that this audience would care about and the top posts have not covered.`,
  });
}

function medianOpeningWords(posts: TrendPost[]) {
  const counts = posts.filter((p) => p.spokenOpening).map((p) => countWords(p.spokenOpening!)).sort((a, b) => a - b);
  return counts.length >= 3 ? counts[Math.floor(counts.length / 2)] : null;
}

function evidenceBlock(grounding: Grounding | null) {
  if (!grounding) return "EVIDENCE: no live trend data is available. Rely on the topic and well-established common knowledge only. Do not claim anything is trending or recent.";
  return `TREND BRIEF (from scraped posts):\n${JSON.stringify(
    {
      audience: grounding.audience,
      angles: grounding.angles.map(({ angle, whyNow }) => ({ angle, whyNow })),
      hookPatterns: grounding.hookPatterns.map((h) => h.pattern),
      unverifiedClaims: grounding.claims.map((c) => c.claim),
      saturatedAngles: grounding.saturated,
      freshGap: grounding.gap,
    },
    null,
    1,
  )}`;
}

async function writeHooks(topic: string, message: string, notes: string, grounding: Grounding | null, corpus: string, median: number | null, emit: Emit): Promise<Hook[]> {
  const evidence = `${message} ${notes}`;
  const maxWords = median && median > 14 ? Math.min(median + 2, 24) : 16;
  const norm = median ? `Niche norm: top posts here open with about ${median} spoken words.` : "";
  const system = `You are the best short-form hook writer alive.\n${HOOK_PLAYBOOK}\n${VOICE_RULES}\n${TRUTH_RULES}`;
  const basePrompt = `Topic: ${topic}\nCreator's request: ${message}\n\n${creator(notes)}\n\n${evidenceBlock(grounding)}\n\n${norm}\n\nWrite 10 hook candidates. Use at least 6 different archetypes. Attack the fresh gap, avoid the saturated angles. Maximum ${maxWords} spoken words each.`;

  let hooks = (await generate({ tier: "hook", name: "hooks", schema: hookBatchSchema, system, user: basePrompt })).hooks;
  let results = hooks.map((hook) => ({ hook, problems: lintHook(hook, { corpus, notes: evidence, topic, maxWords }) }));
  let passing = results.filter((r) => !r.problems.length).map((r) => r.hook);

  if (passing.length < 5) {
    emit("Rewriting weak hooks", `${passing.length} of ${hooks.length} passed the checks`);
    const rejected = results.filter((r) => r.problems.length).map((r) => `- "${r.hook.spoken}": ${r.problems.join("; ")}`).join("\n");
    hooks = (await generate({ tier: "hook", name: "hooks", schema: hookBatchSchema, system, user: `${basePrompt}\n\nThese were rejected. Write replacements that fix the reasons:\n${rejected}` })).hooks;
    results = hooks.map((hook) => ({ hook, problems: lintHook(hook, { corpus, notes: evidence, topic, maxWords }) }));
    passing = [...passing, ...results.filter((r) => !r.problems.length).map((r) => r.hook)];
  }
  if (!passing.length) throw new Error("No hook passed the quality checks. Try giving more detail about the topic.");
  return passing;
}

async function pickHooks(topic: string, hooks: Hook[], grounding: Grounding | null): Promise<Hook[]> {
  const { ratings } = await generate({
    tier: "hook",
    name: "hook_ratings",
    schema: criticSchema,
    system: `You are a ruthless short-form editor scoring hooks for a stranger scrolling at speed. Most hooks are mediocre. Use the full 1 to 5 range and give 5 rarely.
coldClarity: a stranger instantly knows what this is about.
gap: bounded curiosity. 1 if vague or if it gives away the answer, 5 if the subject is concrete and the answer truly cannot be guessed.
stakes: high-arousal feeling and a clear cost or reward.
mouthfeel: sounds like a real person talking, one breath.
deliverable: the video can truly pay this off with the evidence available, with no bait.
freshness: unlike what is saturated in this niche.`,
    user: `Topic: ${topic}\n\n${evidenceBlock(grounding)}\n\nHooks:\n${hooks.map((h, i) => `${i}. [${h.archetype}] "${h.spoken}" (promises: ${h.payoffPromise})`).join("\n")}\n\nRate every hook by index.`,
  });
  const scored = ratings
    .filter((r) => hooks[r.index] && r.coldClarity >= 3 && r.deliverable >= 3)
    .map((r) => ({ hook: hooks[r.index], score: r.gap * 2 + r.coldClarity * 1.5 + r.stakes * 1.5 + r.mouthfeel + r.deliverable + r.freshness }))
    .sort((a, b) => b.score - a.score);
  const ordered = scored.length ? scored.map((s) => s.hook) : hooks;

  const picked: Hook[] = [];
  for (const hook of ordered) if (picked.length < 3 && !picked.some((p) => p.archetype === hook.archetype)) picked.push(hook);
  for (const hook of ordered) if (picked.length < 3 && !picked.includes(hook)) picked.push(hook);
  return picked;
}

const writerSystem = `You write short-form video scripts that people watch to the end and send to friends.\n${BODY_PLAYBOOK}\n${ENDING_PLAYBOOK}\n${VOICE_RULES}\n${TRUTH_RULES}`;

async function writeBody(topic: string, message: string, notes: string, hook: Hook, grounding: Grounding | null, corpus: string, durationSec: number, emit: Emit) {
  const budget = wordBudget(durationSec);
  const base = `Topic: ${topic}\nCreator's request: ${message}\n\n${creator(notes)}\n\n${evidenceBlock(grounding)}\n\nLOCKED HOOK (do not repeat it, the first beat follows straight after):\n"${hook.spoken}"\nIt promises: ${hook.payoffPromise}\n\nWrite the rest of a ${durationSec}-second script. The hook plus all beats must total about ${budget.target} spoken words, between ${budget.min} and ${budget.max}. Beat kinds in order: one "proof", then "point" beats with exactly one "turn" among them, then one "payoff", then one "ending". The title is a plain 2 to 6 word label for this video. Also write a one or two line post caption. List every precise factual claim you used in factsToCheck, as a short phrase. Empty if there are none.`;

  let draft = await generate({ tier: "write", name: "script", schema: draftSchema, system: writerSystem, user: base });
  let result = lintScript(hook, draft.beats, { durationSec, corpus, notes: `${message} ${notes}`, topic, factsToCheck: draft.factsToCheck });
  for (let i = 0; i < 2 && result.repairable.length; i++) {
    emit("Tightening the script", result.repairable[0]);
    draft = await generate({
      tier: "write",
      name: "script",
      schema: draftSchema,
      system: writerSystem,
      user: `${base}\n\nCURRENT DRAFT:\n${JSON.stringify(draft)}\n\nFix these problems and change as little else as possible:\n${result.repairable.map((p) => `- ${p}`).join("\n")}`,
    });
    result = lintScript(hook, draft.beats, { durationSec, corpus, notes: `${message} ${notes}`, topic, factsToCheck: draft.factsToCheck });
  }
  return { draft, flags: [...result.flags, ...result.repairable.map((p) => `Unresolved: ${p}`)] };
}

const toSource = (post: TrendPost, now: number): Source => ({
  id: post.id,
  platform: post.platform,
  url: post.url,
  author: post.author,
  views: post.views,
  ageDays: ageInDays(post.postedAt, now) === null ? null : Math.round(ageInDays(post.postedAt, now)!),
  opening: post.spokenOpening ?? post.caption.split("\n")[0].slice(0, 140),
  openingIsSpoken: Boolean(post.spokenOpening),
});

function citedSources(grounding: Grounding | null, posts: TrendPost[]): Source[] {
  const now = Date.now();
  if (!grounding) return [];
  const ids = new Set([...grounding.angles, ...grounding.hookPatterns, ...grounding.claims].flatMap((item) => item.postIds));
  return posts.filter((p) => ids.has(p.id)).map((p) => toSource(p, now));
}

export async function createScript(input: { topic: string; message: string; durationSec: number; notes: string; refresh: boolean; useTrends: boolean; emit: Emit }): Promise<{ script: Script; content: string }> {
  const { topic, message, durationSec, notes, refresh, useTrends, emit } = input;
  let trends: TrendResult | null = null;
  let grounding: Grounding | null = null;
  let trendNote = "";

  if (!useTrends) {
    trendNote = "Trends were turned off for this script.";
  } else if (apifyEnabled()) {
    emit("Finding what's working now", "Choosing searches");
    try {
      const { hashtags, keywords } = await buildQueries(topic);
      emit("Finding what's working now", [...hashtags.map((h) => `#${h}`), ...keywords].join(", "));
      trends = await collectTrends(topic, hashtags, keywords, { refresh, onProgress: (detail) => emit("Finding what's working now", detail) });
      if (trends.failures.length) console.warn("[trends]", trends.failures);
    } catch (error) {
      console.error("[trends]", error);
      trendNote = `Trend search failed (${error instanceof Error ? error.message : "unknown error"}).`;
    }
    if (trends?.posts.length) {
      emit("Reading the top posts", `${trends.posts.length} ranked from ${trends.scanned}`);
      grounding = await ground(topic, trends, notes);
    } else if (trends && !trendNote) {
      trendNote = trends.failures.length ? `Trend search failed (${trends.failures[0]}).` : "No recent posts found for this topic.";
    }
  } else {
    trendNote = "Apify is not set up.";
  }

  const posts = trends?.posts ?? [];
  const corpus = posts.map((p) => `${p.spokenOpening ?? ""} ${p.caption}`).join("\n");

  emit("Writing hooks", "10 candidates across different angles");
  const candidates = await writeHooks(topic, message, notes, grounding, corpus, medianOpeningWords(posts), emit);
  emit("Scoring hooks", `Judging ${candidates.length} like a stranger scrolling`);
  const [hook, ...alternates] = await pickHooks(topic, candidates, grounding);

  emit("Writing the script", `${durationSec} seconds around the winning hook`);
  const { draft, flags } = await writeBody(topic, message, notes, hook, grounding, corpus, durationSec, emit);

  const live = Boolean(grounding);
  const partial = trends?.failures.length ? ` Partial data: ${trends.failures.map((f) => f.split(":")[0]).join(", ")} failed.` : "";
  const script: Script = {
    title: draft.title,
    topic,
    durationSec,
    hook,
    beats: draft.beats,
    caption: draft.caption,
    alternates,
    sources: citedSources(grounding, posts),
    flags,
    trend: {
      status: live ? (trends!.fromCache ? "cached" : "live") : "none",
      fetchedAt: live ? trends!.fetchedAt : null,
      scanned: trends?.scanned ?? 0,
      note: live ? partial.trim() : trendNote,
    },
    grounding,
    corpus,
  };
  const content = live
    ? `Here's your script. I scanned ${trends!.scanned} recent posts. The opening I went for: ${grounding!.gap}${partial}`
    : `${trendNote} This script is evergreen and is not based on current trends.`;
  return { script, content };
}

async function applyRevision(current: Script, instruction: string, notes: string, emit: Emit): Promise<{ script: Script; content: string }> {
  const budget = wordBudget(current.durationSec);
  const { corpus, grounding, durationSec } = current;
  const user = `${creator(notes)}\n\n${evidenceBlock(grounding)}\n\nCURRENT SCRIPT:\n${JSON.stringify({ title: current.title, hook: current.hook, beats: current.beats, caption: current.caption })}\n\nINSTRUCTION: ${instruction}\n\nApply the instruction and change only what it requires. Keep the hook unless the instruction concerns it. If you write a new hook, follow the hook rules and update all its fields. Total spoken words between ${budget.min} and ${budget.max} unless the instruction changes the length. Beat kinds must stay in order: "proof", "point" beats with one "turn", "payoff", "ending". List every precise factual claim in factsToCheck. changeSummary is one plain sentence on what changed.`;
  const system = `${writerSystem}\n${HOOK_PLAYBOOK}`;

  let revised = await generate({ tier: "write", name: "revision", schema: revisionSchema, system, user });
  const lengthChanged = /\b(short|long|cut|trim|expand|seconds?|sec)\b/i.test(instruction);
  const evidence = `${instruction} ${notes}`;
  const check = () => {
    const result = lintScript(revised.hook, revised.beats, { durationSec, corpus, notes: evidence, topic: current.topic, factsToCheck: revised.factsToCheck });
    return lengthChanged ? { ...result, repairable: result.repairable.filter((p) => !p.startsWith("script is")) } : result;
  };
  let result = check();
  if (result.repairable.length) {
    emit("Tightening the script", result.repairable[0]);
    revised = await generate({ tier: "write", name: "revision", schema: revisionSchema, system, user: `${user}\n\nYOUR LAST ATTEMPT:\n${JSON.stringify(revised)}\n\nFix:\n${result.repairable.map((p) => `- ${p}`).join("\n")}` });
    result = check();
  }
  const script: Script = {
    ...current,
    title: revised.title,
    hook: revised.hook,
    beats: revised.beats,
    caption: revised.caption,
    flags: [...result.flags, ...result.repairable.map((p) => `Unresolved: ${p}`)],
  };
  return { script, content: revised.changeSummary };
}

export function reviseScript(current: Script, instruction: string, notes: string, emit: Emit) {
  emit("Revising", instruction.slice(0, 80));
  return applyRevision(current, instruction, notes, emit);
}

export async function swapHook(current: Script, index: number, notes: string, emit: Emit) {
  const next = current.alternates[index];
  if (!next) throw new Error("That hook no longer exists.");
  emit("Swapping the hook", "Adjusting the transition into the script");
  const { script } = await applyRevision(
    { ...current, hook: next },
    `The hook was just replaced with the one shown. Keep that hook exactly. Update only the first beat so it follows naturally, and the payoff if needed so it delivers: ${next.payoffPromise}`,
    notes,
    emit,
  );
  const alternates = current.alternates.map((hook, i) => (i === index ? current.hook : hook));
  return { script: { ...script, hook: next, alternates }, content: `Switched to: "${next.spoken}"` };
}

export type { Beat };
