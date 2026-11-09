"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ClipboardCheck, Clapperboard, Copy, Lightbulb, Pencil, Play, Sparkles, Split, TriangleAlert } from "lucide-react";
import type { Script, ViewKind } from "@/lib/schemas";
import { WORDS_PER_MINUTE } from "@/lib/playbook";
import { KIND_LABEL, VIEW_CHIPS } from "@/lib/views";

const CHIP_ICON: Record<ViewKind, typeof Clapperboard> = { shot_list: Clapperboard, hooks: Split, checklist: ClipboardCheck, evidence: Lightbulb };
const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const compact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

function trendLabel(script: Script) {
  const { status, scanned, fetchedAt } = script.trend;
  if (status === "live") return `Live trends · ${scanned} posts scanned`;
  if (status === "cached") {
    const hours = Math.round((Date.now() - Date.parse(fetchedAt ?? "")) / 3_600_000);
    return `Trends from ${hours < 1 ? "under an hour" : `${hours}h`} ago · ${scanned} posts`;
  }
  return "Evergreen · no trend data";
}

export function ScriptCard(props: {
  messageId: string;
  script: Script;
  busy: boolean;
  onSwap: (hookIndex: number, hook: string) => void;
  onRescan: () => void;
  onEdited: (script: Script) => void;
  onView: (kind: ViewKind, label: string) => void;
}) {
  const { messageId, script, busy, onSwap, onRescan, onEdited, onView } = props;
  const [editing, setEditing] = useState(false);
  const [hookDraft, setHookDraft] = useState(script.hook.spoken);
  const [beatDrafts, setBeatDrafts] = useState(script.beats.map((b) => b.spoken));
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const words = countWords([script.hook.spoken, ...script.beats.map((b) => b.spoken)].join(" "));
  const seconds = Math.round((words / WORDS_PER_MINUTE) * 60);

  const beginEdit = () => {
    setHookDraft(script.hook.spoken);
    setBeatDrafts(script.beats.map((b) => b.spoken));
    setEditing(true);
  };

  const save = async () => {
    setError("");
    const response = await fetch(`/api/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hookSpoken: hookDraft, beats: script.beats.map((beat, i) => ({ ...beat, spoken: beatDrafts[i] })) }),
    });
    if (!response.ok) {
      setError("Couldn't save. Check that no line is empty.");
      return;
    }
    onEdited(await response.json());
    setEditing(false);
  };

  const copy = async () => {
    await navigator.clipboard.writeText([script.hook.spoken, ...script.beats.map((b) => b.spoken)].join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article className="script">
      <header className="script-head">
        <h2>{script.title}</h2>
        <p className="script-meta">
          <span className={`trend trend-${script.trend.status}`}><Sparkles size={13} />{trendLabel(script)}</span>
          <span>{words} words · about {seconds}s</span>
        </p>
      </header>

      <section className="hook">
        <span className="label">Hook · {script.hook.archetype.replaceAll("_", " ")}</span>
        {editing ? (
          <textarea className="edit edit-hook" value={hookDraft} rows={2} onChange={(e) => setHookDraft(e.target.value)} />
        ) : (
          <p className="hook-line">{script.hook.spoken}</p>
        )}
        <dl className="hook-layers">
          <div><dt>On screen</dt><dd>{script.hook.onScreenText}</dd></div>
          <div><dt>First frame</dt><dd>{script.hook.firstFrame}</dd></div>
        </dl>
      </section>

      <ol className="beats">
        {script.beats.map((beat, index) => (
          <li key={index}>
            <span className="label">{KIND_LABEL[beat.kind]}</span>
            {editing ? (
              <textarea
                className="edit"
                rows={3}
                value={beatDrafts[index]}
                onChange={(e) => setBeatDrafts((d) => d.map((v, i) => (i === index ? e.target.value : v)))}
              />
            ) : (
              <p>{beat.spoken}</p>
            )}
            {beat.direction && <p className="direction">{beat.direction}</p>}
          </li>
        ))}
      </ol>

      {script.flags.length > 0 && (
        <ul className="flags">
          {script.flags.map((flag) => <li key={flag}><TriangleAlert size={15} />{flag}</li>)}
        </ul>
      )}
      {script.trend.note && <p className="note">{script.trend.note}</p>}
      {error && <p className="flags-error">{error}</p>}

      <div className="actions">
        {editing ? (
          <>
            <button className="primary" onClick={save}>Save</button>
            <button onClick={() => setEditing(false)}>Cancel</button>
          </>
        ) : (
          <>
            <Link className="primary" href={`/prompter/${messageId}`}><Play size={15} fill="currentColor" />Open teleprompter</Link>
            <button onClick={beginEdit}><Pencil size={15} />Edit</button>
            <button onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}</button>
          </>
        )}
      </div>

      {!editing && (
        <div className="view-chips" role="group" aria-label="See this script another way">
          {VIEW_CHIPS.map((chip) => (
            <button key={chip.kind} disabled={busy} onClick={() => onView(chip.kind, chip.label)}>
              {(() => {
                const Icon = CHIP_ICON[chip.kind];
                return <Icon size={15} />;
              })()}
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {script.alternates.length > 0 && (
        <details className="more" open>
          <summary>Other hooks</summary>
          <ul className="alternates">
            {script.alternates.map((hook, index) => (
              <li key={hook.spoken}>
                <p>{hook.spoken}</p>
                <button disabled={busy} onClick={() => onSwap(index, hook.spoken)}>Use this</button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {script.caption && (
        <details className="more">
          <summary>Caption</summary>
          <p className="caption">{script.caption}</p>
        </details>
      )}

      {script.sources.length > 0 && (
        <details className="more">
          <summary>What this was based on ({script.sources.length})</summary>
          <ul className="sources">
            {script.sources.map((source) => (
              <li key={source.id}>
                <a href={source.url} target="_blank" rel="noreferrer">@{source.author || "unknown"}</a>
                <span>
                  {source.platform === "tiktok" ? "TikTok" : "Instagram"}
                  {source.views !== null && ` · ${compact(source.views)} views`}
                  {source.ageDays !== null && ` · ${source.ageDays}d old`}
                </span>
                <p>{source.openingIsSpoken ? "Said: " : "Caption: "}{source.opening}</p>
              </li>
            ))}
          </ul>
          <button className="linkish" disabled={busy} onClick={onRescan}>Re-scan trends and write again</button>
        </details>
      )}
    </article>
  );
}
