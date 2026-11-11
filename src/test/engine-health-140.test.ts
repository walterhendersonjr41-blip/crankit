import { afterEach, describe, expect, it } from "vitest";
import {
  MODEL_SPECS,
  findModelSpec,
  findModelSpecById,
  hasOfficialIdle,
  hasOfficialMax,
  officialMaxRpm,
} from "../data/modelSpecs";
import {
  AUTO_DETECT_SECONDS,
  UNSURE_ENGINE,
  classifyEngine,
  formatConfidence,
  shortlistEngines,
  summarize,
  syntheticDetectWave,
} from "../lib/engineDetect";
import { mismatchPrompt, readingLooksWrong } from "../lib/engineSanity";
import {
  LIKELY_NOT_CERTAIN,
  analyzeMisses,
  firingHzForRpm,
  formatMissRate,
  syntheticMissWave,
} from "../lib/missDetect";
import {
  HEALTH_FORMULA,
  computeHealthScore,
  firstBaseline,
  formatHealthDate,
  formatHealthScore,
  loadHealthRecord,
  machineWithEngineLine,
  markToolCustom,
  recordMismatchConfirm,
  saveHealthCheck,
  scoringSpec,
  toolHistoryReportText,
  usesOwnBaseline,
} from "../lib/toolHealth";
import { STORAGE_KEYS } from "../lib/storage";
import { findModelSpec as findSpec } from "../data/modelSpecs";

afterEach(() => {
  localStorage.clear();
});

describe("verified 4-stroke model specs", () => {
  const four = MODEL_SPECS.filter((s) => s.engineCycle === "4-stroke");

  it("adds nine official 4-stroke engines and looks them up by name or id", () => {
    expect(four).toHaveLength(9);
    expect(findModelSpec("Honda GX160")?.id).toBe("honda-gx160");
    expect(findModelSpec("GX200")?.id).toBe("honda-gx200");
    expect(findModelSpec("GCV160")?.id).toBe("honda-gcv160");
    expect(findModelSpec("GCV170")?.id).toBe("honda-gcv170");
    expect(findModelSpec("GCV190")?.id).toBe("honda-gcv190");
    expect(findModelSpec("Predator 212")?.id).toBe("predator-212");
    expect(findModelSpec("Briggs 220700")?.id).toBe("briggs-220700-252700");
    expect(findModelSpec("Kohler Courage SV470")?.id).toBe("kohler-courage-sv");
    expect(findModelSpec("Kohler XT-7")?.id).toBe("kohler-xt");
    expect(findModelSpecById("honda-gx160")?.name).toMatch(/GX160/);
  });

  it("keeps official idle / governed only, and still omits unverified Craftsman and SRM-225 WOT", () => {
    const gx = findModelSpec("GX160")!;
    expect(hasOfficialIdle(gx)).toBe(true);
    expect(hasOfficialMax(gx)).toBe(true);
    expect((gx.maxRpmMin! + gx.maxRpmMax!) / 2).toBe(3900);
    const gcv = findModelSpec("GCV160")!;
    expect(hasOfficialIdle(gcv)).toBe(true);
    expect(hasOfficialMax(gcv)).toBe(false);
    const pred = findModelSpec("Predator 212")!;
    expect(hasOfficialIdle(pred)).toBe(true);
    expect(hasOfficialMax(pred)).toBe(false);
    expect(findModelSpec("Craftsman WC215")?.id).toBeUndefined();
    expect(hasOfficialMax(findModelSpec("SRM-225")!)).toBe(false);
    for (const spec of four) {
      expect(spec.source.url).toMatch(/^https?:\/\//);
    }
  });
});

describe("Miss Detector on synthetic signals", () => {
  const sr = 44100;
  const hz = firingHzForRpm(9000, "2-stroke");

  it("labels a clean wave as healthy with a low miss rate", () => {
    const wave = syntheticMissWave("healthy", hz, sr, 1.2);
    const r = analyzeMisses(wave, sr, { cycle: "2-stroke", mode: "full-throttle" });
    expect(r.pattern).toBe("healthy");
    expect(r.missRate).toBeLessThan(0.08);
    expect(formatMissRate(r.missRate)).toMatch(/%/);
  });

  it("flags regular skips as a spark issue, cheapest check first", () => {
    const wave = syntheticMissWave("regular-skip", hz, sr, 1.2);
    const r = analyzeMisses(wave, sr, { cycle: "2-stroke" });
    expect(r.pattern).toBe("regular-skip");
    expect(r.missRate).toBeGreaterThan(0.1);
    expect(r.likelyCause.toLowerCase()).toMatch(/plug|spark|wire|coil/);
    expect(r.likelyCause).toMatch(/plug/i);
    expect(LIKELY_NOT_CERTAIN.toLowerCase()).toMatch(/likely/);
  });

  it("flags a WOT surge as lean and a burble as rich", () => {
    const surge = analyzeMisses(syntheticMissWave("surge", hz, sr, 1.4), sr, {
      cycle: "2-stroke",
      mode: "full-throttle",
    });
    expect(surge.pattern).toBe("surge");
    expect(surge.likelyCause.toLowerCase()).toMatch(/filter|line|air leak|carb/);
    const rich = analyzeMisses(syntheticMissWave("rich-burble", hz, sr, 1.4), sr, { cycle: "2-stroke", mode: "full-throttle" });
    expect(rich.pattern).toBe("rich-burble");
    expect(rich.likelyCause.toLowerCase()).toMatch(/air filter|spark-arrestor|arrestor/);
  });

  it("flags a bog on the way up and misses that worsen when hot", () => {
    const bog = analyzeMisses(syntheticMissWave("bog", firingHzForRpm(3000), sr, 1.2), sr, {
      cycle: "2-stroke",
      mode: "full-throttle",
    });
    expect(bog.pattern).toBe("bog");
    expect(bog.likelyCause.toLowerCase()).toMatch(/circuit|diaphragm/);
    const hot = analyzeMisses(syntheticMissWave("hot-coil", hz, sr, 1.6), sr, {
      cycle: "2-stroke",
      engineHot: true,
    });
    expect(hot.pattern).toBe("hot-coil");
    expect(hot.likelyCause.toLowerCase()).toMatch(/coil/);
  });
});

describe("wrong-engine sanity check", () => {
  const gx = findSpec("GX160")!;

  it("prompts when RPM is more than 30% off official or looks like the other cycle", () => {
    expect(mismatchPrompt("Honda GX160")).toBe("This doesn't sound like a Honda GX160. Did you pick the right engine?");
    const idleOk = readingLooksWrong(1400, "idle", { spec: gx, cycle: "4-stroke" });
    expect(idleOk.mismatch).toBe(false);
    const far = readingLooksWrong(2000, "idle", { spec: gx, cycle: "4-stroke", modelName: gx.name });
    expect(far.mismatch).toBe(true);
    expect(far.reason).toBe("percent");
    expect(far.message).toMatch(/Doesn't sound like a Honda GX160/i);
    const cycle = readingLooksWrong(10000, "full-throttle", { spec: gx, cycle: "4-stroke", modelName: gx.name });
    expect(cycle.mismatch).toBe(true);
    expect(cycle.reason).toBe("cycle");
    const twoStrokeOk = readingLooksWrong(3000, "idle", { spec: findSpec("GT-225")!, cycle: "2-stroke" });
    expect(twoStrokeOk.mismatch).toBe(false);
    const twoAsFour = readingLooksWrong(1400, "idle", { spec: findSpec("GT-225")!, cycle: "2-stroke" });
    expect(twoAsFour.mismatch).toBe(true);
  });

  it("does not treat an in-range official reading or a custom tool as a mismatch", () => {
    expect(readingLooksWrong(1550, "idle", { spec: gx, cycle: "4-stroke" }).mismatch).toBe(false);
    expect(readingLooksWrong(10000, "full-throttle", { spec: gx, cycle: "4-stroke", custom: true }).mismatch).toBe(false);
  });
});

describe("Tool History health score and custom / engine-swap", () => {
  it("shows a whole-number percent and barely moves on a 1% drift", () => {
    const gx = findSpec("GX160")!;
    const first = computeHealthScore({
      idleRpm: 1400,
      idleStability: 0.01,
      wotRpm: 3900,
      missRate: 0.005,
      spec: gx,
    });
    expect(formatHealthScore(first)).toMatch(/^\d+%$/);
    expect(formatHealthScore(99.6)).toBe("100%");
    expect(formatHealthScore(99.2)).toBe("99%");
    expect(first).toBeGreaterThan(99);
    const later = computeHealthScore({
      idleRpm: 1414,
      idleStability: 0.012,
      wotRpm: 3880,
      missRate: 0.008,
      spec: gx,
    });
    expect(first - later).toBeLessThan(1.5);
    expect(later).toBeGreaterThan(98);
    expect(formatHealthDate("2026-12-23T15:00:00-05:00")).toMatch(/12\/23\/26/);
    expect(HEALTH_FORMULA).toMatch(/whole-number percent/i);
    expect(HEALTH_FORMULA).not.toMatch(/one decimal/i);
    expect(HEALTH_FORMULA).toMatch(/Modified/);
  });

  it("does not save a health check until the mismatch is confirmed", () => {
    const blocked = saveHealthCheck({
      toolId: "t1",
      idleRpm: 10000,
      allowSave: false,
    });
    expect(blocked).toBeUndefined();
    expect(loadHealthRecord("t1")).toBeUndefined();
    const saved = saveHealthCheck({ toolId: "t1", idleRpm: 1400, idleStability: 0.01, confirmedMismatch: true });
    expect(saved?.isBaseline).toBe(true);
    expect(firstBaseline("t1")?.id).toBe(saved?.id);
    expect(loadHealthRecord("t1")?.checks).toHaveLength(1);
  });

  it("judges a known unmodified swap against that engine's stock specs, and uses own baseline when modified or unknown", () => {
    const gx = findSpec("GX160")!;
    const known = markToolCustom("swap1", { installedEngine: "Honda GX160", installedSpecId: "honda-gx160", modified: false });
    expect(usesOwnBaseline(known)).toBe(false);
    expect(scoringSpec(findSpec("GT-225"), known)?.id).toBe("honda-gx160");
    const vsStock = computeHealthScore({ idleRpm: 1400, wotRpm: 3900, missRate: 0, spec: findSpec("GT-225"), custom: known });
    expect(vsStock).toBeGreaterThan(99);
    const vsWrong = computeHealthScore({ idleRpm: 3000, wotRpm: 7500, missRate: 0, spec: findSpec("GT-225"), custom: known });
    expect(vsWrong).toBeLessThan(80);

    const modified = markToolCustom("swap2", { installedEngine: "Honda GX160", installedSpecId: "honda-gx160", modified: true });
    expect(usesOwnBaseline(modified)).toBe(true);
    const baseline = {
      id: "b",
      at: "2026-01-01T00:00:00.000Z",
      toolId: "swap2",
      idleRpm: 2800,
      wotRpm: 4200,
      score: 100,
      isBaseline: true,
    };
    const drift = computeHealthScore({
      idleRpm: 2820,
      wotRpm: 4180,
      missRate: 0,
      spec: gx,
      custom: modified,
      baseline,
    });
    expect(drift).toBeGreaterThanOrEqual(99);

    const unknown = markToolCustom("swap3", { installedEngine: "homebuilt 212", modified: false });
    expect(usesOwnBaseline(unknown)).toBe(true);
    expect(scoringSpec(gx, unknown)).toBeUndefined();

    const twice = recordMismatchConfirm("swap4");
    expect(twice.confirmCount).toBe(1);
    expect(recordMismatchConfirm("swap4").confirmCount).toBe(2);
  });

  it("writes a Tool history report as Machine X with engine Y and no personal info", () => {
    markToolCustom("t-rpt", { installedEngine: "Honda GX160", installedSpecId: "honda-gx160" });
    saveHealthCheck({ toolId: "t-rpt", idleRpm: 1400, wotRpm: 3900, missRate: 0.004, idleStability: 0.01 });
    const setup = loadHealthRecord("t-rpt")!.custom;
    const line = machineWithEngineLine("Craftsman mower", setup);
    expect(line).toBe("Machine Craftsman mower with engine Honda GX160");
    const text = toolHistoryReportText({
      tool: { name: "Craftsman mower", brandModel: "Craftsman mower", toolType: "lawn-mower", brand: "craftsman" },
      makeModel: "Craftsman mower",
      record: loadHealthRecord("t-rpt")!,
      timeline: [],
    });
    expect(text).toContain("Tool history report");
    expect(text).toContain("Machine Craftsman mower with engine Honda GX160");
    expect(text).toMatch(/Health Score/i);
    expect(text).not.toMatch(/@/);
    expect(text).not.toMatch(/\d{3}[-.]\d{3}[-.]\d{4}/);
    expect(STORAGE_KEYS.health).toBe("crankit.toolHealth");
  });
});

describe("Auto-detect engine on synthetic signals", () => {
  const sr = 44100;
  const sec = AUTO_DETECT_SECONDS;

  it("classifies a governed single-cylinder 4-stroke around 3,600 RPM", () => {
    const wave = syntheticDetectWave("4-stroke", 3600, sr, sec, { cylinders: 1, governed: true });
    const series = Array.from({ length: 12 }, () => 3600 + (Math.random() - 0.5) * 20);
    const g = classifyEngine(wave, sr, series);
    expect(g.lowConfidence).toBe(false);
    expect(g.cycle).toBe("4-stroke");
    expect(g.cylinders).toBe("single");
    expect(g.style).toBe("governed");
    expect(g.rpm!).toBeGreaterThan(3300);
    expect(g.rpm!).toBeLessThan(4000);
    expect(g.summary).toMatch(/Sounds like a single-cylinder 4-stroke, governed ~3,600 RPM/);
    expect(g.confidence).toBeGreaterThan(0.5);
    expect(formatConfidence(g.confidence)).toMatch(/% confident/);
    expect(g.matches.some((s) => s.id === "honda-gx160" || s.id === "honda-gx200" || s.id === "kohler-courage-sv")).toBe(true);
  });

  it("classifies a high-RPM 2-stroke as free-revving and shortlists 2-stroke models", () => {
    const wave = syntheticDetectWave("2-stroke", 9000, sr, 2.2, { cylinders: 1, governed: false });
    const series = Array.from({ length: 10 }, () => 9000 + (Math.random() - 0.5) * 80);
    const g = classifyEngine(wave, sr, series);
    expect(g.lowConfidence).toBe(false);
    expect(g.cycle).toBe("2-stroke");
    expect(g.cylinders).toBe("single");
    expect(g.style).toBe("free-revving");
    expect(g.rpm!).toBeGreaterThan(8000);
    expect(g.rpm!).toBeLessThan(10000);
    expect(g.summary).toMatch(/2-stroke/);
    expect(g.summary).toMatch(/free-revving/);
    expect(g.matches.every((s) => s.engineCycle !== "4-stroke")).toBe(true);
  });

  it("classifies a twin 4-stroke at a steady governed speed", () => {
    const wave = syntheticDetectWave("4-stroke", 3600, sr, 2.5, { cylinders: 2, governed: true });
    const g = classifyEngine(wave, sr, Array.from({ length: 10 }, () => 3600));
    expect(g.lowConfidence).toBe(false);
    expect(g.cycle).toBe("4-stroke");
    expect(g.cylinders).toBe("twin");
    expect(g.summary).toMatch(/twin-cylinder 4-stroke/);
  });

  it("says Not sure — pick your engine on noise, and never auto-assigns a model", () => {
    const noise = new Float32Array(sr * 2);
    for (let i = 0; i < noise.length; i++) noise[i] = (Math.random() - 0.5) * 0.02;
    const g = classifyEngine(noise, sr);
    expect(g.lowConfidence).toBe(true);
    expect(g.summary).toBe(UNSURE_ENGINE);
    expect(g.matches).toEqual([]);
    expect(summarize(null, null, "unknown", null, 0.2)).toBe(UNSURE_ENGINE);
    // Shortlist is a suggestion only — classifyEngine does not write any tool or spec.
    expect(shortlistEngines({ ...g, lowConfidence: true })).toEqual([]);
  });
});
