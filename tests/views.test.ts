import { describe, expect, it } from "vitest";
import { buildChecklist, buildShots } from "@/lib/views";
import type { Beat, Hook } from "@/lib/schemas";

const words = (n: number) => Array(n).fill("word").join(" ");
const hook: Hook = { spoken: words(5), onScreenText: "Wait", firstFrame: "Hold up the bill", archetype: "belief_flip", payoffPromise: "" };
const beat = (kind: Beat["kind"], spoken: string, direction = ""): Beat => ({ kind, spoken, direction });

describe("buildShots", () => {
  it("runs timing on from the previous shot at speaking pace", () => {
    const shots = buildShots({ hook, beats: [beat("proof", words(25), "Show it"), beat("ending", words(10))] });
    expect(shots.map((s) => s.time)).toEqual(["0:00–0:02", "0:02–0:12", "0:12–0:16"]);
  });
  it("leads with the first frame and defaults empty directions", () => {
    const shots = buildShots({ hook, beats: [beat("ending", "Bye now")] });
    expect(shots[0].action).toBe("Hold up the bill");
    expect(shots[1].action).toBe("Talk to camera");
  });
});

describe("buildChecklist", () => {
  it("drops empty groups", () => {
    expect(buildChecklist({ hook, beats: [beat("ending", "x")], flags: [] }).map((g) => g.title)).toEqual(["First frame"]);
  });
  it("puts facts to verify first and removes duplicate shots", () => {
    const groups = buildChecklist({ hook, beats: [beat("point", "x", "Same"), beat("turn", "y", "Same")], flags: ["Verify before filming: price"] });
    expect(groups[0].items).toEqual(["Verify before filming: price"]);
    expect(groups[2].items).toEqual(["Same"]);
  });
});
