import { WORDS_PER_MINUTE } from "./playbook";
import type { Script, ViewKind } from "./schemas";

export const KIND_LABEL: Record<string, string> = { proof: "Proof", point: "Build", turn: "Turn", payoff: "Payoff", ending: "End" };

export const VIEW_TITLES: Record<ViewKind, string> = {
  shot_list: "Here's your shot list.",
  hooks: "Here are your hooks side by side.",
  evidence: "Here's why this script went this way.",
  checklist: "Here's your filming checklist.",
};

export const VIEW_CHIPS: { kind: ViewKind; label: string }[] = [
  { kind: "shot_list", label: "Shot list" },
  { kind: "hooks", label: "Compare hooks" },
  { kind: "checklist", label: "Filming checklist" },
  { kind: "evidence", label: "Why this works" },
];

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const secondsFor = (text: string) => (text.trim().split(/\s+/).filter(Boolean).length / WORDS_PER_MINUTE) * 60;

export type Shot = { time: string; label: string; action: string; spoken: string };

/** Estimates each shot's timing from its word count at speaking pace. */
export function buildShots(script: Pick<Script, "hook" | "beats">): Shot[] {
  const { hook, beats } = script;
  let at = 0;
  const shot = (label: string, action: string, spoken: string): Shot => {
    const start = at;
    at += secondsFor(spoken);
    return { time: `${clock(start)}–${clock(at)}`, label, action, spoken };
  };
  return [shot("Hook", hook.firstFrame, hook.spoken), ...beats.map((beat) => shot(KIND_LABEL[beat.kind], beat.direction || "Talk to camera", beat.spoken))];
}

export type ChecklistGroup = { title: string; items: string[] };

export function buildChecklist(script: Pick<Script, "hook" | "beats" | "flags">): ChecklistGroup[] {
  const shots = [...new Set(script.beats.map((beat) => beat.direction).filter(Boolean))];
  const groups: ChecklistGroup[] = [
    { title: "Before you film", items: script.flags },
    { title: "First frame", items: [script.hook.firstFrame, `Add on-screen text: "${script.hook.onScreenText}"`] },
    { title: "Shots to get", items: shots },
  ];
  return groups.filter((group) => group.items.length > 0);
}
