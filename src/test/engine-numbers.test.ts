import { afterEach, describe, expect, it } from "vitest";
import {
  ENGINE_NUMBERS_DISCLAIMER,
  LOW_COMPRESSION_PSI,
  PLUG_COLORS,
  deleteEngineNumberLog,
  engineLogsForModel,
  engineNumberHints,
  hasEngineNumberValues,
  loadEngineNumbers,
  parseOptionalNumber,
  recordEngineNumbers,
} from "../lib/engineNumbers";
import { STORAGE_KEYS } from "../lib/storage";

afterEach(() => {
  localStorage.removeItem(STORAGE_KEYS.engineNumbers);
});

describe("engine numbers log", () => {
  it("parses optional numbers and stores a log tied to the engine model", () => {
    expect(parseOptionalNumber("")).toBeUndefined();
    expect(parseOptionalNumber("120")).toBe(120);
    expect(parseOptionalNumber("12,500")).toBe(12500);
    expect(parseOptionalNumber(-4)).toBeUndefined();
    expect(parseOptionalNumber("nope")).toBeUndefined();
    expect(LOW_COMPRESSION_PSI).toBe(90);
    expect(PLUG_COLORS).toEqual(["tan/brown", "black/sooty", "white/ashy", "wet/oily"]);

    const saved = recordEngineNumbers({
      toolId: "tool-1",
      make: "STIHL",
      model: "MS 170",
      compressionPsi: 85,
      wotRpm: 12500,
      plugColor: "white/ashy",
      engineHours: 40,
      notes: "Cold check with a borrowed gauge",
    });
    expect(loadEngineNumbers()).toHaveLength(1);
    expect(loadEngineNumbers()[0].id).toBe(saved.id);
    expect(engineLogsForModel("stihl", "ms 170")).toHaveLength(1);
    expect(engineLogsForModel("ECHO", "GT-225")).toHaveLength(0);
    expect(hasEngineNumberValues({ notes: "" })).toBe(false);
    expect(hasEngineNumberValues({ compressionPsi: 85, notes: "" })).toBe(true);
  });

  it("gives general plug and compression hints and keeps the disclaimer", () => {
    expect(engineNumberHints({ compressionPsi: 120, plugColor: "tan/brown" })).toEqual([
      "Tan or brown is typically a healthy plug color.",
    ]);
    expect(engineNumberHints({ compressionPsi: 89 })).toEqual([
      "Compression under ~90 PSI often means worn rings or a worn cylinder.",
    ]);
    expect(engineNumberHints({ compressionPsi: 90 })).toEqual([]);
    expect(engineNumberHints({ plugColor: "white/ashy" })[0]).toMatch(/lean or the engine is too hot/);
    expect(engineNumberHints({ plugColor: "black/sooty" })[0]).toMatch(/rich mix|too much oil|choke/);
    expect(engineNumberHints({ plugColor: "wet/oily" })[0]).toMatch(/flooding|too much oil|seal/);
    expect(ENGINE_NUMBERS_DISCLAIMER).toMatch(/general guides/i);
    expect(ENGINE_NUMBERS_DISCLAIMER).toMatch(/manual/i);
  });

  it("ignores an unknown plug color and can delete a log", () => {
    const saved = recordEngineNumbers({
      make: "ECHO",
      model: "GT-225",
      plugColor: "rainbow" as never,
      notes: "Just a note",
    });
    expect(saved.plugColor).toBeUndefined();
    expect(saved.notes).toBe("Just a note");
    deleteEngineNumberLog(saved.id);
    expect(loadEngineNumbers()).toHaveLength(0);
  });
});
