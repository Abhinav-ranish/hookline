import {
  ageInDays,
  capPerAuthor,
  firstSentence,
  interleave,
  isEnglish,
  normalizeInstagram,
  normalizeTiktok,
  openingFromVtt,
  usableOpening,
  rankPlatform,
  type TrendPost,
} from "./trends";
import { getCachedTrends, setCachedTrends } from "./db";

const API = "https://api.apify.com/v2";
const CACHE_MS = 6 * 3_600_000;
const TERMINAL = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"]);

export type TrendSnapshot = { posts: TrendPost[]; scanned: number; failures: string[] };
export type TrendResult = TrendSnapshot & { fetchedAt: string; fromCache: boolean };

export const apifyEnabled = () => Boolean(process.env.APIFY_TOKEN);

async function apify(path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.APIFY_TOKEN}`, "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const body = await response.text();
    let message = body.slice(0, 200);
    try {
      message = JSON.parse(body).error?.message ?? message;
    } catch {}
    throw new Error(`Apify ${response.status}: ${message}`);
  }
  return response.json();
}

async function runActor(actor: string, input: unknown, maxItems: number, timeoutSecs = 150): Promise<Record<string, any>[]> {
  // Some actors reject a cap below $0.50.
  const maxUsd = Math.max(Number(process.env.APIFY_MAX_USD_PER_RUN) || 0.5, 0.5);
  const params = new URLSearchParams({
    maxItems: String(maxItems),
    maxTotalChargeUsd: String(maxUsd),
    timeout: String(timeoutSecs),
    waitForFinish: "60",
  });
  const started = await apify(`/acts/${actor.replace("/", "~")}/runs?${params}`, { method: "POST", body: JSON.stringify(input) });
  let run = started.data;
  const deadline = Date.now() + (timeoutSecs + 30) * 1000;
  while (!TERMINAL.has(run.status) && Date.now() < deadline) {
    run = (await apify(`/actor-runs/${run.id}?waitForFinish=30`)).data;
  }
  // A timed-out or budget-capped run still has useful partial results in its dataset.
  const items = await apify(`/datasets/${run.defaultDatasetId}/items?clean=true&limit=${maxItems}`);
  if (run.status !== "SUCCEEDED" && items.length === 0) throw new Error(`${actor} ended with status ${run.status}`);
  return items;
}

const scrapeInstagram = (hashtags: string[]) =>
  runActor("apify/instagram-hashtag-scraper", { hashtags, resultsType: "reels", resultsLimit: 25 }, 75);

// Search is the slow, costly part. Partial results from a timeout are still used.
const scrapeTiktok = (keywords: string[], hashtags: string[]) =>
  runActor(
    "clockworks/tiktok-scraper",
    {
      searchQueries: keywords,
      hashtags: hashtags.slice(0, 1),
      searchSection: "/video",
      videoSearchSorting: "MOST_LIKED",
      videoSearchDateFilter: "PAST_MONTH",
      resultsPerPage: 15,
      excludePinnedPosts: true,
    },
    45,
    90,
  );

// Instagram transcripts are billed at about $0.08 each, so only the very top reels get one.
async function addInstagramTranscripts(posts: TrendPost[]) {
  const items = await runActor("apify/instagram-reel-scraper", { username: posts.map((p) => p.url), resultsLimit: 1, includeTranscript: true }, posts.length, 75);
  const byShortcode = new Map(items.map((item) => [`ig_${item.shortCode}`, item]));
  for (const post of posts) {
    const transcript = byShortcode.get(post.id)?.transcript;
    if (typeof transcript === "string") post.spokenOpening = usableOpening(firstSentence(transcript));
  }
}

async function readSubtitles(post: TrendPost) {
  if (!post.subtitleUrl) return;
  const fromApify = new URL(post.subtitleUrl).hostname === "api.apify.com";
  const response = await fetch(post.subtitleUrl, fromApify ? { headers: { Authorization: `Bearer ${process.env.APIFY_TOKEN}` } } : undefined);
  if (response.ok) post.spokenOpening = usableOpening(openingFromVtt(await response.text()));
}

async function addTiktokTranscripts(posts: TrendPost[]) {
  // Search results usually include subtitle links already, which cost nothing to read.
  const missing = posts.filter((p) => !p.subtitleUrl).slice(0, 5);
  if (missing.length) {
    const items = await runActor("clockworks/tiktok-scraper", { postURLs: missing.map((p) => p.url), downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES", resultsPerPage: 1 }, missing.length, 60);
    for (const item of items) {
      const post = missing.find((p) => p.id === `tt_${item.id}`);
      if (post) post.subtitleUrl = normalizeTiktok(item)?.subtitleUrl ?? null;
    }
  }
  await Promise.allSettled(posts.map(readSubtitles));
}

async function scrape(hashtags: string[], keywords: string[], onProgress: (detail: string) => void): Promise<TrendSnapshot> {
  const now = Date.now();
  onProgress("Searching Instagram and TikTok");
  const [instagram, tiktok] = await Promise.allSettled([scrapeInstagram(hashtags), scrapeTiktok(keywords, hashtags)]);

  const failures: string[] = [];
  const collect = (result: PromiseSettledResult<Record<string, any>[]>, name: string, normalize: (item: any) => TrendPost | null) => {
    if (result.status === "rejected") {
      failures.push(`${name}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      return [];
    }
    return result.value.map(normalize).filter((p): p is TrendPost => p !== null);
  };
  const all = [...collect(instagram, "Instagram", normalizeInstagram), ...collect(tiktok, "TikTok", normalizeTiktok)];
  const deduped = [...new Map(all.map((p) => [p.url, p])).values()];
  const english = deduped.filter(isEnglish);
  const unique = english.length >= 8 ? english : deduped;

  const recentWithin = (days: number) => unique.filter((p) => (ageInDays(p.postedAt, now) ?? Infinity) <= days);
  const recent = recentWithin(45).length >= 8 ? recentWithin(45) : recentWithin(120);
  const rank = (platform: TrendPost["platform"]) =>
    capPerAuthor(rankPlatform(recent.filter((p) => p.platform === platform), now)).slice(0, 12);
  const instagramTop = rank("instagram");
  const tiktokTop = rank("tiktok");

  onProgress(`Found ${recent.length} recent posts, reading what the top ones actually say`);
  const enrich = await Promise.allSettled([
    instagramTop.length ? addInstagramTranscripts(instagramTop.slice(0, 4)) : Promise.resolve(),
    tiktokTop.length ? addTiktokTranscripts(tiktokTop) : Promise.resolve(),
  ]);
  for (const result of enrich) {
    if (result.status === "rejected") failures.push(`Transcripts: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
  }
  return { posts: interleave(instagramTop, tiktokTop), scanned: unique.length, failures };
}

export async function collectTrends(
  topic: string,
  hashtags: string[],
  keywords: string[],
  options: { refresh: boolean; onProgress: (detail: string) => void },
): Promise<TrendResult> {
  const key = topic.trim().toLowerCase().replace(/\s+/g, " ");
  if (!options.refresh) {
    const cached = await getCachedTrends<TrendSnapshot>(key, CACHE_MS);
    if (cached) return { ...cached.value, fetchedAt: cached.fetchedAt, fromCache: true };
  }
  const snapshot = await scrape(hashtags, keywords, options.onProgress);
  const fetchedAt = snapshot.posts.length ? await setCachedTrends(key, snapshot) : new Date().toISOString();
  return { ...snapshot, fetchedAt, fromCache: false };
}
