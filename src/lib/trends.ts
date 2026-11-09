export type TrendPost = {
  id: string;
  platform: "instagram" | "tiktok";
  url: string;
  author: string;
  caption: string;
  language: string | null;
  spokenOpening: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  followers: number | null;
  durationSec: number | null;
  postedAt: string | null;
  subtitleUrl: string | null;
  score: number;
};

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null);
const str = (value: unknown): string => (typeof value === "string" ? value : "");

type Raw = Record<string, any>;

export function normalizeInstagram(item: Raw): TrendPost | null {
  const url = str(item.url);
  if (!url || item.paidPartnership === true) return null;
  const isVideo = item.type === "Video" || item.productType === "clips";
  if (!isVideo) return null;
  return {
    id: `ig_${item.shortCode ?? item.id}`,
    platform: "instagram",
    url,
    author: str(item.ownerUsername),
    caption: str(item.caption),
    language: null,
    spokenOpening: usableOpening(firstSentence(str(item.transcript))),
    views: num(item.videoPlayCount) ?? num(item.igPlayCount) ?? num(item.videoViewCount),
    likes: num(item.likesCount),
    comments: num(item.commentsCount),
    shares: num(item.sharesCount) ?? num(item.reshareCount),
    saves: null,
    followers: null,
    durationSec: num(item.videoDuration),
    postedAt: str(item.timestamp) || null,
    subtitleUrl: null,
    score: 0,
  };
}

export function normalizeTiktok(item: Raw): TrendPost | null {
  const url = str(item.webVideoUrl);
  if (!url || item.isAd === true || item.isSponsored === true || item.isSlideshow === true) return null;
  const subtitles: Raw[] = item.videoMeta?.subtitleLinks ?? [];
  const english = subtitles.find((s) => /^(eng|en)/i.test(str(s.language)));
  return {
    id: `tt_${item.id}`,
    platform: "tiktok",
    url,
    author: str(item.authorMeta?.name ?? item["authorMeta.name"]),
    caption: str(item.text),
    language: str(item.textLanguage) || null,
    spokenOpening: null,
    views: num(item.playCount),
    likes: num(item.diggCount),
    comments: num(item.commentCount),
    shares: num(item.shareCount),
    saves: num(item.collectCount),
    followers: num(item.authorMeta?.fans),
    durationSec: num(item.videoMeta?.duration ?? item["videoMeta.duration"]),
    postedAt: str(item.createTimeISO) || null,
    subtitleUrl: english ? str(english.downloadLink) || str(english.tiktokLink) || null : null,
    score: 0,
  };
}

export function firstSentence(text: string, maxWords = 30): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const match = clean.match(/^.*?[.?!](?=\s|$)/);
  const sentence = match && match[0].split(" ").length >= 3 ? match[0] : clean;
  return sentence.split(" ").slice(0, maxWords).join(" ");
}

const ENGLISH_WORDS = /\b(the|you|your|this|that|how|why|what|with|for|and|is|are|to|of|my)\b/i;

export function isEnglish(post: Pick<TrendPost, "caption" | "language">) {
  if (post.language) return post.language.toLowerCase().startsWith("en");
  const letters = post.caption.replace(/[#@][\w.]+/g, "").match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return false;
  const latin = letters.filter((c) => /[a-z]/i.test(c)).length;
  return latin / letters.length > 0.9 && ENGLISH_WORDS.test(post.caption);
}

/** Transcripts of music or mumbling yield fragments that say nothing about the hook. */
export const usableOpening = (text: string | null) => (text && text.trim().split(/\s+/).length >= 4 ? text : null);

/** Extracts what was actually said in the opening seconds of a WebVTT subtitle file. */
export function openingFromVtt(vtt: string, windowSec = 6): string | null {
  const cues = [...vtt.matchAll(/(?:(\d+):)?(\d{2}):(\d{2})[.,]\d{3}\s*-->.*\n([\s\S]*?)(?=\n\s*\n|$)/g)];
  const words: string[] = [];
  for (const cue of cues) {
    const start = Number(cue[1] ?? 0) * 3600 + Number(cue[2]) * 60 + Number(cue[3]);
    if (start > windowSec) break;
    words.push(cue[4].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
  }
  const text = words.join(" ").trim();
  return text ? firstSentence(text) : null;
}

export function ageInDays(postedAt: string | null, now: number): number | null {
  if (!postedAt) return null;
  const time = Date.parse(postedAt);
  return Number.isNaN(time) ? null : Math.max(0, (now - time) / 86_400_000);
}

function percentiles(values: (number | null)[]): number[] {
  const known = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  return values.map((value) => {
    if (value === null || known.length < 2) return 0.5;
    let below = 0;
    while (below < known.length && known[below] < value) below++;
    return below / (known.length - 1);
  });
}

/**
 * Scores posts within one platform. One scrape can only show what is popular for
 * its age, not real momentum, so views are normalized by age. Unknown metrics score neutral.
 */
export function rankPlatform(posts: TrendPost[], now: number): TrendPost[] {
  const velocity = posts.map((p) => {
    const age = ageInDays(p.postedAt, now);
    return p.views === null || age === null ? null : p.views / Math.pow(Math.max(age, 0.5), 0.7);
  });
  const reachOverAudience = posts.map((p) => (p.views !== null && p.followers ? p.views / (p.followers + 1000) : null));
  const shareRate = posts.map((p) => {
    if (p.views === null || (p.shares === null && p.saves === null)) return null;
    return ((p.shares ?? 0) + (p.saves ?? 0) + 2) / (p.views + 1000);
  });
  const v = percentiles(velocity);
  const r = percentiles(reachOverAudience);
  const s = percentiles(shareRate);
  return posts
    .map((p, i) => ({ ...p, score: 0.5 * v[i] + 0.2 * r[i] + 0.3 * s[i] }))
    .sort((a, b) => b.score - a.score);
}

export function capPerAuthor<T extends { author: string }>(posts: T[], cap = 2): T[] {
  const seen = new Map<string, number>();
  return posts.filter((p) => {
    const count = seen.get(p.author) ?? 0;
    seen.set(p.author, count + 1);
    return count < cap;
  });
}

/** Merges platforms by alternating, so a bigger TikTok sample cannot crowd out Instagram. */
export function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
}
