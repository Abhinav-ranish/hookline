import type { Beat, Hook } from "./schemas";
import { wordBudget } from "./playbook";

const BANNED_OPENERS =
  /^\s*(hey|hi|hello|what'?s up|welcome|so,? today|today,? i|today we|in this video|did you know|stop scrolling|you won'?t believe|wait for it|let me tell you|let'?s talk|here are \d|here'?s the thing)\b/i;
const BANNED_PHRASES =
  /(game.?changer|you won'?t believe|nobody('?s| is) talking about|no one('?s| is) talking about|stop scrolling|follow for more|like,? comment|smash that)/i;
const NEGATION_FORMULA = /\b(it'?s not|isn'?t|not just|not only)\b[^.?!]{1,50}[,;:—-]\s*(it'?s|it is|but)\b/i;
const FIRST_PERSON_EXPERIENCE =
  /\b(i|i've|i'd|we|we've|my)\b[^.?!]{0,30}\b(lost|made|grew|spent|tested|tried|quit|earned|built|gained|switched|went from|started|fired|hired|doubled|tripled|saved)\b/i;

const SELF_REFERENCE = /\b(videos?|reels?|tiktoks?|creators?|influencers?|posts?|views|viral|algorithm)\b/i;

export const talksAboutContent = (text: string, topic: string) => SELF_REFERENCE.test(text) && !SELF_REFERENCE.test(topic);

export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export const spokenText = (hook: Pick<Hook, "spoken">, beats: Pick<Beat, "spoken">[]) =>
  [hook.spoken, ...beats.map((b) => b.spoken)].join(" ");

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9%$ ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

function shingles(text: string, size: number) {
  const words = normalize(text);
  const out = new Set<string>();
  for (let i = 0; i + size <= words.length; i++) out.add(words.slice(i, i + size).join(" "));
  return out;
}

export function copiedPhrase(text: string, corpus: string, size = 5): string | null {
  const source = shingles(corpus, size);
  for (const s of shingles(text, size)) if (source.has(s)) return s;
  return null;
}

export function unsupportedNumbers(text: string, corpus: string): string[] {
  const numbers = text.match(/\$?\d[\d,]*(?:\.\d+)?\s?(?:%|percent|x\b|k\b|million|billion)?/gi) ?? [];
  const source = corpus.toLowerCase().replace(/,/g, "");
  return [...new Set(numbers.map((n) => n.trim()))].filter((n) => {
    const bare = n.toLowerCase().replace(/[,$]/g, "").match(/\d+(?:\.\d+)?/)?.[0];
    return bare !== undefined && !new RegExp(`(^|[^\\d.])${bare.replace(".", "\\.")}([^\\d]|$)`).test(source);
  });
}

export const claimsPersonalExperience = (text: string) => FIRST_PERSON_EXPERIENCE.test(text);

export function lintHook(hook: Hook, opts: { corpus: string; notes: string; topic: string; maxWords?: number }): string[] {
  const problems: string[] = [];
  const words = countWords(hook.spoken);
  const maxWords = opts.maxWords ?? 16;
  if (words > maxWords) problems.push(`too long at ${words} words, limit ${maxWords}`);
  if (words < 3) problems.push("too short to carry a promise");
  if (BANNED_OPENERS.test(hook.spoken)) problems.push("uses a banned opener");
  if (BANNED_PHRASES.test(hook.spoken)) problems.push("uses a banned phrase");
  if (talksAboutContent(hook.spoken, opts.topic)) problems.push("talks about videos or content instead of the topic");
  const copied = copiedPhrase(hook.spoken, opts.corpus);
  if (copied) problems.push(`copies scraped wording: "${copied}"`);
  if (claimsPersonalExperience(hook.spoken) && !claimsPersonalExperience(opts.notes))
    problems.push("claims a personal experience the creator never supplied");
  const numbers = unsupportedNumbers(hook.spoken, `${opts.corpus} ${opts.notes}`);
  if (numbers.length) problems.push(`uses unsupported numbers: ${numbers.join(", ")}`);
  return problems;
}

export type ScriptLint = { repairable: string[]; flags: string[] };

export function lintScript(hook: Hook, beats: Beat[], opts: { durationSec: number; corpus: string; notes: string; topic: string; factsToCheck: string[] }): ScriptLint {
  const repairable: string[] = [];
  const flags: string[] = [];
  const text = spokenText(hook, beats);
  const words = countWords(text);
  const { min, max } = wordBudget(opts.durationSec);
  if (words > max) repairable.push(`script is ${words} words, cut it to at most ${max}`);
  if (words < min) repairable.push(`script is ${words} words, expand it to at least ${min}`);

  const kinds = beats.map((b) => b.kind);
  if (!kinds.includes("payoff")) repairable.push('missing a "payoff" beat');
  if (kinds.at(-1) !== "ending") repairable.push('the final beat must be kind "ending"');
  if (kinds.indexOf("payoff") !== -1 && kinds.indexOf("payoff") < kinds.length - 2)
    repairable.push("the payoff must come immediately before the ending");

  for (const beat of beats) {
    if (beat.kind !== "ending" && talksAboutContent(beat.spoken, opts.topic)) repairable.push(`talk about the topic, not about videos or content, in: "${beat.spoken}"`);
    if (BANNED_PHRASES.test(beat.spoken)) repairable.push(`banned phrase in: "${beat.spoken}"`);
    if (NEGATION_FORMULA.test(beat.spoken)) repairable.push(`rewrite the "not X, it's Y" construction in: "${beat.spoken}"`);
    if (/[—;#]/.test(beat.spoken)) repairable.push(`remove em dashes, semicolons or hashtags from: "${beat.spoken}"`);
  }

  for (const fact of opts.factsToCheck) flags.push(`Verify before filming: ${fact}`);
  const evidence = `${opts.corpus} ${opts.notes} ${opts.factsToCheck.join(" ")}`;
  const copied = copiedPhrase(text, opts.corpus, 7);
  if (copied) repairable.push(`copies scraped wording: "${copied}"`);
  if (claimsPersonalExperience(text) && !claimsPersonalExperience(opts.notes))
    repairable.push("remove the first-person experience, the creator never supplied one");

  const numbers = unsupportedNumbers(text, evidence);
  if (numbers.length) flags.push(`Check before filming, not found in the sources: ${numbers.join(", ")}`);
  return { repairable, flags };
}
