import { describe, expect, it } from "vitest";
import { claimsPersonalExperience, copiedPhrase, lintHook, lintScript, unsupportedNumbers } from "@/lib/lint";
import type { Beat, Hook } from "@/lib/schemas";

const hook = (spoken: string): Hook => ({ spoken, onScreenText: "", firstFrame: "", archetype: "belief_flip", payoffPromise: "" });
const beat = (kind: Beat["kind"], spoken: string): Beat => ({ kind, spoken, direction: "" });
const words = (n: number) => Array(n).fill("word").join(" ");

describe("lintHook", () => {
  const opts = { corpus: "", notes: "", topic: "sleep" };
  it("accepts a bounded hook", () => expect(lintHook(hook("Your magnesium is probably the wrong kind for sleep"), opts)).toEqual([]));
  it("rejects greetings", () => expect(lintHook(hook("Hey guys, let me explain magnesium"), opts)).toContain("uses a banned opener"));
  it("rejects long hooks", () => expect(lintHook(hook(words(20)), opts)[0]).toMatch(/too long/));
  it("rejects copied wording", () => {
    const result = lintHook(hook("The US Navy taught its pilots to sleep"), { corpus: "the us navy taught its pilots to fall asleep", notes: "", topic: "sleep" });
    expect(result.join()).toMatch(/copies scraped wording/);
  });
  it("rejects invented experience", () => expect(lintHook(hook("I lost everything chasing this trend"), opts).join()).toMatch(/personal experience/));
  it("allows experience the creator supplied", () => {
    expect(lintHook(hook("I lost everything chasing this trend"), { corpus: "", notes: "I lost my savings on ads", topic: "ads" })).toEqual([]);
  });
  it("rejects hooks about content", () => expect(lintHook(hook("This viral clip gets sleep totally wrong"), opts).join()).toMatch(/videos or content/));
  it("allows content talk when that is the topic", () => expect(lintHook(hook("Your reels die in the first second"), { ...opts, topic: "growing on reels" })).toEqual([]));
  it("rejects invented numbers", () => expect(lintHook(hook("This costs you 37% of your sleep"), opts).join()).toMatch(/unsupported numbers/));
});

describe("unsupportedNumbers", () => {
  it("matches numbers in the sources, ignoring commas", () => expect(unsupportedNumbers("It got 10,000 views", "reached 10000 people")).toEqual([]));
  it("does not match a number inside a longer one", () => expect(unsupportedNumbers("Only 40 people", "about 400 people")).toEqual(["40"]));
});

describe("copiedPhrase", () => {
  it("ignores case and punctuation", () => expect(copiedPhrase("Fall ASLEEP in two minutes, flat", "you can fall asleep in two minutes")).toBeTruthy());
  it("allows short overlaps", () => expect(copiedPhrase("fall asleep tonight", "fall asleep in two minutes")).toBeNull());
});

describe("claimsPersonalExperience", () => {
  it("catches invented stories", () => expect(claimsPersonalExperience("We tested forty brands")).toBe(true));
  it("ignores plain opinions", () => expect(claimsPersonalExperience("I think this is wrong")).toBe(false));
});

describe("lintScript", () => {
  const good = [beat("proof", words(40)), beat("point", words(30)), beat("turn", words(20)), beat("payoff", words(10)), beat("ending", "Send this to your brother.")];
  const opts = { durationSec: 45, corpus: "", notes: "", topic: "sleep", factsToCheck: [] as string[] };
  it("passes a well-formed script", () => expect(lintScript(hook("Five words in this hook"), good, opts).repairable).toEqual([]));
  it("catches overlong scripts", () => {
    const long = [beat("point", words(200)), ...good.slice(3)];
    expect(lintScript(hook("Five words in this hook"), long, opts).repairable[0]).toMatch(/cut it/);
  });
  it("requires the ending last", () => {
    expect(lintScript(hook("Five words in this hook"), [...good].reverse(), opts).repairable.join()).toMatch(/final beat/);
  });
  it("catches the negation cliche", () => {
    const beats = [beat("proof", `It's not about willpower, it's about timing. ${words(90)}`), ...good.slice(3)];
    expect(lintScript(hook("Five words in this hook"), beats, opts).repairable.join()).toMatch(/not X/);
  });
  it("sends meta talk back for repair", () => {
    const beats = [beat("proof", `One plunge video has huge numbers. ${words(90)}`), ...good.slice(3)];
    expect(lintScript(hook("Five words in this hook"), beats, opts).repairable.join()).toMatch(/not about videos/);
  });
  it("lists declared facts and does not double-flag their numbers", () => {
    const beats = [beat("proof", `Water at 50 degrees works. ${words(90)}`), ...good.slice(3)];
    const result = lintScript(hook("Five words in this hook"), beats, { ...opts, factsToCheck: ["50 degrees is effective"] });
    expect(result.flags).toEqual(["Verify before filming: 50 degrees is effective"]);
  });
  it("flags unsupported numbers without blocking", () => {
    const beats = [beat("proof", `About 72 percent do this. ${words(90)}`), ...good.slice(3)];
    const result = lintScript(hook("Five words in this hook"), beats, opts);
    expect(result.flags[0]).toMatch(/72/);
  });
});
