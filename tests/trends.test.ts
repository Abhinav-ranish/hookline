import { describe, expect, it } from "vitest";
import { capPerAuthor, firstSentence, interleave, isEnglish, normalizeInstagram, normalizeTiktok, openingFromVtt, rankPlatform, usableOpening, type TrendPost } from "@/lib/trends";
import { rememberInNotes } from "@/lib/pipeline";
import { wordBudget } from "@/lib/playbook";

const now = Date.parse("2026-11-09T00:00:00Z");
const post = (over: Partial<TrendPost>): TrendPost => ({
  id: Math.random().toString(), platform: "tiktok", url: "u", author: "a", caption: "", language: null, spokenOpening: null, views: 1000, likes: 10, comments: 1, shares: null, saves: null,
  followers: null, durationSec: 30, postedAt: "2026-11-01T00:00:00Z", subtitleUrl: null, score: 0, ...over,
});

describe("openingFromVtt", () => {
  const vtt = "WEBVTT\n\n\n00:00:00.000 --> 00:00:03.400\nUS Navy taught its pilots to fall asleep in two minutes.\n\n00:00:03.460 --> 00:00:06.280\nBecause a tired pilot makes deadly mistakes,\n\n00:00:09.000 --> 00:00:10.000\nlater line\n";
  it("returns the first spoken sentence", () => expect(openingFromVtt(vtt)).toBe("US Navy taught its pilots to fall asleep in two minutes."));
  it("handles an empty file", () => expect(openingFromVtt("WEBVTT\n")).toBeNull());
  it("joins cues until the sentence ends", () => {
    expect(openingFromVtt("WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nYour coffee is\n\n00:00:02.000 --> 00:00:04.000\nruining your sleep. Here is why\n")).toBe("Your coffee is ruining your sleep.");
  });
});

describe("usableOpening", () => {
  it("drops fragments from music", () => expect(usableOpening("feel my")).toBeNull());
  it("keeps real sentences", () => expect(usableOpening("this is a real opening")).toBeTruthy());
});

describe("firstSentence", () => {
  it("caps run-on transcripts", () => expect(firstSentence(Array(60).fill("word").join(" ")).split(" ")).toHaveLength(30));
});

describe("normalizers", () => {
  it("skips Instagram images and paid posts", () => {
    expect(normalizeInstagram({ url: "x", type: "Image" })).toBeNull();
    expect(normalizeInstagram({ url: "x", type: "Video", paidPartnership: true })).toBeNull();
  });
  it("reads Instagram play counts", () => {
    expect(normalizeInstagram({ url: "x", type: "Video", shortCode: "a", videoPlayCount: 5, sharesCount: 1 })).toMatchObject({ views: 5, shares: 1 });
  });
  it("tolerates null TikTok subtitle links and picks English", () => {
    expect(normalizeTiktok({ webVideoUrl: "x", id: "1", videoMeta: { subtitleLinks: null } })?.subtitleUrl).toBeNull();
    expect(normalizeTiktok({ webVideoUrl: "x", id: "1", videoMeta: { subtitleLinks: [{ language: "kor-KR", downloadLink: "k" }, { language: "en", downloadLink: "e" }] } })?.subtitleUrl).toBe("e");
  });
  it("skips TikTok ads", () => expect(normalizeTiktok({ webVideoUrl: "x", isAd: true })).toBeNull());
});

describe("rankPlatform", () => {
  it("prefers a newer post with the same views", () => {
    const ranked = rankPlatform([post({ id: "old", postedAt: "2026-10-01T00:00:00Z" }), post({ id: "new", postedAt: "2026-11-08T00:00:00Z" })], now);
    expect(ranked[0].id).toBe("new");
  });
  it("rewards share rate over raw likes", () => {
    const ranked = rankPlatform([post({ id: "liked", likes: 900, shares: 1 }), post({ id: "shared", likes: 5, shares: 400 })], now);
    expect(ranked[0].id).toBe("shared");
  });
  it("does not punish unknown metrics to zero", () => {
    expect(rankPlatform([post({ id: "a", views: null })], now)[0].score).toBeGreaterThan(0);
  });
});

describe("isEnglish", () => {
  it("trusts a declared language", () => expect(isEnglish({ caption: "x", language: "es" })).toBe(false));
  it("accepts English captions", () => expect(isEnglish({ caption: "How to fix your sleep", language: null })).toBe(true));
  it("rejects non-Latin captions", () => expect(isEnglish({ caption: "थंड बढ़ती जा रही है", language: null })).toBe(false));
  it("rejects Latin non-English captions", () => expect(isEnglish({ caption: "Essa semana um seguidor me chamou", language: null })).toBe(false));
});

describe("helpers", () => {
  it("caps posts per author", () => expect(capPerAuthor([post({}), post({}), post({})]).length).toBe(2));
  it("interleaves unequal lists", () => expect(interleave([1, 2, 3], [9])).toEqual([1, 9, 2, 3]));
  it("sizes word budgets for speech", () => expect(wordBudget(60).target).toBe(150));
  it("remembers a new label", () => expect(rememberInNotes("Tone: dry", "Audience", "founders")).toBe("Tone: dry\nAudience: founders"));
  it("never overwrites a saved label", () => expect(rememberInNotes("Audience: nurses", "Audience", "founders")).toBe("Audience: nurses"));
  it("ignores empty values", () => expect(rememberInNotes("Tone: dry", "Space", " ")).toBe("Tone: dry"));
});
