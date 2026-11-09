"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import type { Script, ViewKind } from "@/lib/schemas";
import { buildChecklist, buildShots } from "@/lib/views";

type Props = { kind: ViewKind; messageId: string; script: Script; busy: boolean; onSwap: (hookIndex: number, hook: string) => void };

function ShotList({ script }: { script: Script }) {
  return (
    <ol className="shots">
      {buildShots(script).map((shot, index) => (
        <li key={index}>
          <div>
            <time>{shot.time}</time>
            <span className="shot-kind">{shot.label}</span>
          </div>
          <div>
            <p className="shot-do">{shot.action}</p>
            <p className="shot-say">{shot.spoken}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function HookCompare({ script, busy, onSwap }: Pick<Props, "script" | "busy" | "onSwap">) {
  const options = [{ hook: script.hook, index: -1 }, ...script.alternates.map((hook, index) => ({ hook, index }))];
  return (
    <div className="hook-compare">
      {options.map(({ hook, index }) => (
        <section key={hook.spoken} className={index === -1 ? "hook-option is-current" : "hook-option"}>
          <p>{hook.spoken}</p>
          <dl>
            <div><dt>Approach</dt><dd>{hook.archetype.replaceAll("_", " ")}</dd></div>
            <div><dt>On screen</dt><dd>{hook.onScreenText}</dd></div>
            <div><dt>First frame</dt><dd>{hook.firstFrame}</dd></div>
            <div><dt>Promises</dt><dd>{hook.payoffPromise}</dd></div>
          </dl>
          {index === -1 ? <span className="in-use">In use</span> : <button disabled={busy} onClick={() => onSwap(index, hook.spoken)}>Use this</button>}
        </section>
      ))}
    </div>
  );
}

function Evidence({ script }: { script: Script }) {
  const { grounding, sources } = script;
  if (!grounding) return <p>This script is evergreen, so there was no live trend data behind it.</p>;
  return (
    <div className="evidence checks">
      <section>
        <h3>The opening it went for</h3>
        <p>{grounding.gap}</p>
      </section>
      <section>
        <h3>Who it's for</h3>
        <p>{grounding.audience}</p>
      </section>
      <section>
        <h3>What's getting traction</h3>
        <ul>{grounding.angles.map((angle) => <li key={angle.angle}>{angle.angle} <span className="why">{angle.whyNow}</span></li>)}</ul>
      </section>
      {grounding.saturated.length > 0 && (
        <section>
          <h3>Already overdone, so avoided</h3>
          <ul>{grounding.saturated.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      )}
      {sources.length > 0 && (
        <section>
          <h3>Posts it drew on</h3>
          <ul>{sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">@{source.author || "unknown"}</a> <span className="why">{source.opening}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}

function Checklist({ script }: { script: Script }) {
  return (
    <div className="checks">
      {buildChecklist(script).map((group) => (
        <section key={group.title}>
          <h3>{group.title}</h3>
          <ul>
            {group.items.map((item) => (
              <li key={item}>
                <label><input type="checkbox" /><span>{item}</span></label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ViewCard({ kind, messageId, script, busy, onSwap }: Props) {
  return (
    <article className="view">
      {kind === "shot_list" && <ShotList script={script} />}
      {kind === "hooks" && <HookCompare script={script} busy={busy} onSwap={onSwap} />}
      {kind === "evidence" && <Evidence script={script} />}
      {kind === "checklist" && <Checklist script={script} />}
      <div className="actions">
        <Link className="primary" href={`/prompter/${messageId}`}><Play size={15} fill="currentColor" />Open teleprompter</Link>
      </div>
    </article>
  );
}
