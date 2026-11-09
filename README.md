# Hookline

Chat with it about a topic. It checks what's working on Instagram and TikTok right now, writes a script built around a strong hook, and puts it on a teleprompter.

## Run it

The live app runs on Cloudflare. Local `pnpm dev` starts, but its local D1 database still needs the schema from `migrations/0001_init.sql` applied before pages load.

## Deploy to Cloudflare

Runs as a Cloudflare Worker with a D1 database. Set `OPENAI_API_KEY`, `APIFY_TOKEN` and `ACCESS_KEY` as Worker secrets. Run `pnpm build`, stop it once it prints "built" if it doesn't exit by itself, then `pnpm run deploy`. Database changes go in `migrations/`. Without `ACCESS_KEY`, the public URL refuses every request. Open `https://<your-worker>/?key=<ACCESS_KEY>` once on each device to sign in.

Keep the page open while a script is generating. Workers stop the work when the connection closes.

## Teleprompter keys

Space plays or pauses. Up and down change speed. Left and right jump between lines. `M` mirrors, `R` restarts, `+` and `-` resize text.

## How a script gets made

1. **Brief.** If your audience or space is unclear, it asks up to two rounds of quick questions and remembers the answers in Your profile.
2. **Trends.** Apify scrapes recent English-language Reels and TikToks, ranked by views for their age and share rate. Real spoken openings are read from transcripts.
3. **Trend brief.** The model extracts angles, abstract hook patterns and an unclaimed idea.
4. **Hooks.** 10 candidates, code checks, separate scoring, top 3 shown.
5. **Script.** Written around the winning hook, then checked for length, structure, copied wording and invented personal stories.

The reasoning and sources are in [docs/hook-research.md](docs/hook-research.md).

## Ask for a different view

Once you have a script, ask in plain English or tap a chip: "give me a shot list", "compare the hooks", "filming checklist", "why will this work". The model only chooses which card to show. Each card renders the script's real data.

## Make it yours

Appearance sets the theme, wallpaper, overlay, blur and accent color. It's remembered per browser. The waveform button in the composer dictates your message, in browsers that support speech recognition. The globe turns live trends off for a script to save Apify credit.

## Costs

A new topic costs roughly $0.65 to $1 in Apify usage. Results are cached per topic for 6 hours, and each actor run is capped by `APIFY_MAX_USD_PER_RUN`. Edits and hook swaps never scrape again.

## Tests

```bash
pnpm test
pnpm typecheck
```
