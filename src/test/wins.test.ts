import { afterEach, describe, expect, it } from "vitest";
import { clearLearning, rankedFixes } from "../lib/mechanicLearning";
import { STORAGE_KEYS } from "../lib/storage";
import {
  formatMoney,
  loadWins,
  parseMoney,
  recordWin,
  totalPartCost,
  totalSaved,
  totalShopSaved,
} from "../lib/wins";

afterEach(() => {
  localStorage.removeItem(STORAGE_KEYS.wins);
  clearLearning();
});

describe("My Wins money and log", () => {
  it("parses dollar amounts and ignores invalid input", () => {
    expect(parseMoney("")).toBeUndefined();
    expect(parseMoney("$12.50")).toBe(12.5);
    expect(parseMoney("1,200")).toBe(1200);
    expect(parseMoney(-1)).toBeUndefined();
    expect(parseMoney("nope")).toBeUndefined();
    expect(formatMoney(138)).toBe("$138.00");
    expect(formatMoney(-4.2)).toBe("-$4.20");
  });

  it("saves a win, totals shop minus parts, and feeds the local learning engine", () => {
    const win = recordWin({
      toolId: "tool-1",
      toolName: "Weed Eater #1",
      toolType: "weed-eater",
      make: "ECHO",
      model: "GT-225",
      symptom: "Dies when I tilt it sideways",
      fix: "Replaced the in-tank fuel line",
      partCost: 4.5,
      shopCostSaved: 85,
      source: "diagnose",
    });
    expect(loadWins()).toHaveLength(1);
    expect(loadWins()[0].id).toBe(win.id);
    expect(totalShopSaved(loadWins())).toBe(85);
    expect(totalPartCost(loadWins())).toBe(4.5);
    expect(totalSaved(loadWins())).toBe(80.5);

    const ranked = rankedFixes({ symptomKey: "dies when i tilt it sideways", toolId: "tool-1" });
    expect(ranked[0]?.fixLabel).toBe("Replaced the in-tank fuel line");
    expect(ranked[0]?.helpful).toBe(1);
  });
});
