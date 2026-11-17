import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteFixOutcome,
  downloadFixOutcomes,
  exportableFixOutcomes,
  fixOutcomesToCsv,
  fixOutcomesToJson,
  loadFixOutcomes,
  modelKey,
  recordFixOutcome,
  summarizeFixesByModel,
  summaryForModel,
} from "../lib/fixOutcomes";
import { STORAGE_KEYS } from "../lib/storage";

afterEach(() => {
  localStorage.removeItem(STORAGE_KEYS.fixOutcomes);
  vi.restoreAllMocks();
});

describe("What fixed it log", () => {
  it("saves an entry tied to brand and model and summarizes the most common working fixes", () => {
    recordFixOutcome({
      make: "ECHO",
      model: "GT-225",
      toolType: "weed-eater",
      symptom: "Dies when I tilt it",
      testDone: "Checked the in-tank line",
      fix: "Replaced the in-tank fuel line",
      ran: "yes",
    });
    recordFixOutcome({
      make: "echo",
      model: "gt-225",
      toolType: "weed-eater",
      symptom: "Dies when I tilt it",
      testDone: "Blew out the filter",
      fix: "Replaced the in-tank fuel line",
      ran: "yes",
    });
    recordFixOutcome({
      make: "ECHO",
      model: "GT-225",
      toolType: "weed-eater",
      symptom: "Hard start",
      testDone: "New plug",
      fix: "New spark plug",
      ran: "no",
    });
    recordFixOutcome({
      make: "STIHL",
      model: "MS 170",
      toolType: "chainsaw",
      symptom: "Won't start",
      testDone: "Wet test",
      fix: "Fresh mix",
      ran: "partly",
    });

    expect(modelKey("ECHO", "GT-225")).toBe(modelKey("echo", "gt-225"));
    expect(loadFixOutcomes()).toHaveLength(4);

    const echo = summaryForModel("ECHO", "GT-225");
    expect(echo?.tried).toBe(3);
    expect(echo?.worked).toBe(2);
    expect(echo?.topFixes[0]?.fix).toBe("Replaced the in-tank fuel line");
    expect(echo?.topFixes[0]?.workedCount).toBe(2);
    expect(echo?.topFixes.some((f) => f.fix === "New spark plug")).toBe(false);

    const summaries = summarizeFixesByModel();
    expect(summaries[0]?.displayName).toMatch(/ECHO/i);
    expect(summaries.find((s) => /STIHL/i.test(s.displayName))?.topFixes).toHaveLength(0);
  });

  it("exports JSON and CSV without a tool nickname, and can delete an entry", () => {
    const saved = recordFixOutcome({
      toolId: "tool-secret",
      make: "ECHO",
      model: "GT-225",
      toolType: "weed-eater",
      symptom: "Dies when I tilt it",
      testDone: "Checked the line",
      fix: "New in-tank fuel line",
      ran: "yes",
      at: "2026-11-17T12:00:00.000Z",
    });
    const json = fixOutcomesToJson();
    expect(json).toContain("New in-tank fuel line");
    expect(json).toContain("Checked the line");
    expect(json).toContain('"ran": "yes"');
    expect(json).not.toContain("tool-secret");
    expect(json).not.toContain(saved.id);
    expect(exportableFixOutcomes()[0]).toMatchObject({
      make: "ECHO",
      model: "GT-225",
      symptom: "Dies when I tilt it",
      testDone: "Checked the line",
      fix: "New in-tank fuel line",
      ran: "yes",
    });

    const csv = fixOutcomesToCsv();
    expect(csv.split("\n")[0]).toBe("date,make,model,toolType,symptom,testDone,fix,ran");
    expect(csv).toContain("ECHO,GT-225,weed-eater");
    expect(csv).toContain("yes");
    expect(csv).not.toContain("tool-secret");

    recordFixOutcome({
      make: "ECHO",
      model: "GT-225",
      symptom: "Bogs",
      testDone: "L screw",
      fix: "Opened L a hair",
      ran: "partly",
    });
    const quoted = recordFixOutcome({
      make: "ECHO",
      model: "GT-225",
      symptom: 'Dies, "tilts"',
      testDone: "Looked it over",
      fix: "Cleaned the tank",
      ran: "no",
    });
    expect(fixOutcomesToCsv()).toContain('"Dies, ""tilts"""');

    deleteFixOutcome(quoted.id);
    expect(loadFixOutcomes()).toHaveLength(2);
  });

  it("downloads JSON or CSV files when asked", () => {
    recordFixOutcome({
      make: "STIHL",
      model: "MS 170",
      symptom: "Won't start",
      testDone: "Spark check",
      fix: "New plug",
      ran: "yes",
    });
    const clicks: { href: string; download: string }[] = [];
    const createObjectURL = vi.fn(() => "blob:crankit-export");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ href: this.href, download: this.download });
    });

    downloadFixOutcomes("csv", loadFixOutcomes(), new Date("2026-11-17T15:00:00-05:00"));
    expect(clicks[0]?.download).toBe("crankit-what-fixed-it-2026-11-17.csv");
    expect(createObjectURL).toHaveBeenCalled();

    downloadFixOutcomes("json", loadFixOutcomes(), new Date("2026-11-17T15:00:00-05:00"));
    expect(clicks[1]?.download).toBe("crankit-what-fixed-it-2026-11-17.json");
  });
});
