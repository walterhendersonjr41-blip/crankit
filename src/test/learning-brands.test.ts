import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BRANDS, brandById, brandForTool, detectBrand, formatBrandNote } from "../data/brands";
import { hasMechanicSync, mechanicSync } from "../config/mechanicSync";
import { composeMechanicReply } from "../lib/mechanicEngine";
import {
  addUserTip,
  clearLearning,
  matchTips,
  provenLine,
  rankedFixes,
  recordBotRating,
  recordDiagnoseFixed,
} from "../lib/mechanicLearning";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("local mechanic learning", () => {
  it("ranks a diagnose FIXED IT first and writes the proven-line copy", () => {
    recordDiagnoseFixed({
      toolId: "saw-1",
      toolName: "Chainsaw #1",
      treeId: "bogs-on-accel",
      treeTitle: "Bogs when I give it gas",
      stepId: "t2-s2",
      stepTitle: "Open the L screw 1/8 turn",
    });
    const ranked = rankedFixes({ symptomKey: "bogs-on-accel", toolId: "saw-1" });
    expect(ranked[0]?.fixLabel).toBe("Open the L screw 1/8 turn");
    expect(ranked[0]?.score).toBeGreaterThan(0);
    expect(provenLine(ranked[0], "Chainsaw #1")).toBe(
      "Last time your Chainsaw #1 did this, Open the L screw 1/8 turn worked.",
    );
  });

  it("prefers a proven same-tool fix over a higher raw count on another tool", () => {
    recordBotRating({
      toolId: "other",
      toolName: "Weed Eater #2",
      symptomKey: "dies-tilted",
      symptomLabel: "Dies when tilted",
      fixKey: "filter",
      fixLabel: "Replaced the fuel filter",
      helpful: true,
    });
    recordBotRating({
      toolId: "other",
      toolName: "Weed Eater #2",
      symptomKey: "dies-tilted",
      symptomLabel: "Dies when tilted",
      fixKey: "filter",
      fixLabel: "Replaced the fuel filter",
      helpful: true,
    });
    recordBotRating({
      toolId: "saw-1",
      toolName: "Chainsaw #1",
      symptomKey: "dies-tilted",
      symptomLabel: "Dies when tilted",
      fixKey: "line",
      fixLabel: "Replaced the in-tank fuel line",
      helpful: true,
    });
    const ranked = rankedFixes({ symptomKey: "dies-tilted", toolId: "saw-1" });
    expect(ranked[0]?.fixLabel).toBe("Replaced the in-tank fuel line");
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it("lets a Didn't help rating drop a fix below a That fixed it rating", () => {
    recordBotRating({
      toolId: "saw-1",
      toolName: "Chainsaw #1",
      symptomKey: "wont-start",
      symptomLabel: "Won't start",
      fixKey: "plug",
      fixLabel: "Swapped the spark plug",
      helpful: false,
    });
    recordBotRating({
      toolId: "saw-1",
      toolName: "Chainsaw #1",
      symptomKey: "wont-start",
      symptomLabel: "Won't start",
      fixKey: "gas",
      fixLabel: "Drained old gas and mixed fresh 50:1",
      helpful: true,
    });
    const ranked = rankedFixes({ symptomKey: "wont-start", toolId: "saw-1" });
    expect(ranked[0]?.fixLabel).toBe("Drained old gas and mixed fresh 50:1");
    const plug = ranked.find((r) => r.fixKey === "plug");
    expect(plug?.unhelpful).toBe(1);
    expect(plug!.score).toBeLessThan(ranked[0]!.score);
  });

  it("matches a Teach the mechanic tip and can clear all learning", () => {
    addUserTip({
      symptom: "Dies when I tilt it",
      fix: "Replaced the in-tank fuel line",
      toolId: "saw-1",
      toolName: "Chainsaw #1",
    });
    const tips = matchTips("It dies when I tilt it sideways");
    expect(tips).toHaveLength(1);
    expect(tips[0]?.fix).toBe("Replaced the in-tank fuel line");

    clearLearning();
    expect(matchTips("It dies when I tilt it sideways")).toHaveLength(0);
    expect(rankedFixes({ symptomKey: "dies when i tilt it" })).toHaveLength(0);
  });

  it("prepends proven lines, taught tips, and stays offline", () => {
    expect(mechanicSync.endpoint).toBe("");
    expect(mechanicSync.apiKey).toBe("");
    expect(hasMechanicSync()).toBe(false);

    recordDiagnoseFixed({
      toolId: "saw-1",
      toolName: "Chainsaw #1",
      treeId: "primer-bulb",
      treeTitle: "Dies when I tilt it",
      stepId: "line",
      stepTitle: "Replaced the in-tank fuel line",
    });
    addUserTip({ symptom: "Dies when I tilt it", fix: "Checked the tank vent too" });

    const reply = composeMechanicReply("It dies when I tilt it sideways", {
      tools: [{ id: "saw-1", name: "Chainsaw #1", brandModel: "MS 170", brand: "stihl", toolType: "chainsaw" }],
      toolId: "saw-1",
    });
    expect(reply.text).toMatch(/Last time your Chainsaw #1 did this, Replaced the in-tank fuel line worked\./);
    expect(reply.text).toMatch(/You taught the mechanic: when “Dies when I tilt it”, try this — Checked the tank vent too\./);
    expect(reply.text).toMatch(/For a STIHL/i);
    expect(reply.text).toMatch(/50:1/);
    expect(reply.text).toMatch(/check the manufacturer/i);
  });
});

describe("brand table", () => {
  const required = ["stihl", "husqvarna", "echo", "poulan", "craftsman", "ryobi", "homelite"] as const;

  it("covers the seven requested brands and sources every included fact", () => {
    const ids = BRANDS.map((b) => b.id);
    for (const id of required) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const brand of BRANDS) {
      expect(brand.sources.length).toBeGreaterThan(0);
      expect(brand.checkManual.toLowerCase()).toMatch(/check/);
      expect(brand.checkManual.toLowerCase()).toMatch(/manual/);
      for (const source of brand.sources) {
        expect(source.title.trim().length).toBeGreaterThan(0);
        expect(source.url).toMatch(/^https?:\/\//);
      }
      for (const fact of [brand.mixRatio, brand.sparkPlug, brand.carbMaker, brand.screwHeads]) {
        if (!fact) continue;
        expect(fact.value.trim().length).toBeGreaterThan(0);
        expect(fact.note.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("omits unverified carb makers and does not invent a single Poulan or Craftsman mix", () => {
    expect(brandById("stihl")?.carbMaker).toBeUndefined();
    expect(brandById("husqvarna")?.carbMaker).toBeUndefined();
    expect(brandById("poulan")?.carbMaker).toBeUndefined();
    expect(brandById("poulan")?.screwHeads).toBeUndefined();
    expect(brandById("craftsman")?.carbMaker).toBeUndefined();
    expect(brandById("ryobi")?.carbMaker).toBeUndefined();
    expect(brandById("homelite")?.carbMaker).toBeUndefined();
    expect(brandById("echo")?.carbMaker?.value).toMatch(/Walbro/i);

    expect(brandById("poulan")?.mixRatio?.value.toLowerCase()).toMatch(/check your manual/);
    expect(brandById("poulan")?.mixRatio?.note).toMatch(/50:1/);
    expect(brandById("poulan")?.mixRatio?.note).toMatch(/40:1/);
    expect(brandById("craftsman")?.mixRatio?.value.toLowerCase()).toMatch(/check your manual/);
    expect(brandById("craftsman")?.mixRatio?.note).toMatch(/40:1/);
    expect(brandById("craftsman")?.mixRatio?.note).toMatch(/Do not assume 50:1/i);
  });

  it("detects brands from names and prefers an explicit garage brand id", () => {
    expect(detectBrand("My old Poulan Pro trimmer")?.id).toBe("poulan");
    expect(detectBrand("Husky 455 Rancher")?.id).toBe("husqvarna");
    expect(brandForTool({ name: "Front-yard trimmer", brandModel: "ECHO SRM-225" })?.id).toBe("echo");
    expect(brandForTool({ name: "ECHO SRM-225", brand: "stihl" })?.id).toBe("stihl");
    const note = formatBrandNote(brandById("stihl")!);
    expect(note).toMatch(/50:1/);
    expect(note).toMatch(/check the manufacturer/i);
    expect(note.toLowerCase()).toMatch(/bpmr7a|wsr 6 f/);
  });
});
