import { describe, expect, it } from "vitest";
import { STAMPED_LETTER_NOTE } from "../data/carbNotes";
import {
  MODEL_SPECS,
  findModelSpec,
  hasOfficialIdle,
  hasOfficialMax,
  officialMaxRpm,
} from "../data/modelSpecs";
import { APP_VERSION } from "../config/appInfo";
import {
  MANUAL_IDLE_NOTE,
  NEED_MAX_BANNER,
  estimateFiring,
  firingHzFromAutocorr,
  hzToRpm,
  idleBand,
  magnitudeSpectrum,
  median,
  rpmToHz,
  syntheticEngineWave,
  tuneVerdict,
} from "../lib/rpmMath";
import { detectIntent, QUICK_CHIPS, replyTo } from "../lib/mechanicEngine";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("RPM math", () => {
  it("converts firing frequency to RPM as Hz × 60, or Hz × 120 for 4-stroke", () => {
    expect(hzToRpm(50)).toBe(3000);
    expect(hzToRpm(200)).toBe(12000);
    expect(rpmToHz(7500)).toBe(125);
    expect(hzToRpm(30, "4-stroke")).toBe(3600);
    expect(hzToRpm(50, "4-stroke")).toBe(6000);
    expect(rpmToHz(3600, "4-stroke")).toBe(30);
  });

  it("takes a median of odd and even windows", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("default verdict thresholds", () => {
  it("closes idle gaps at the documented boundaries", () => {
    expect(tuneVerdict(2499, "idle").tone).toBe("yellow");
    expect(tuneVerdict(2499, "idle").title).toMatch(/Idle Too Low/);
    expect(tuneVerdict(2499, "idle").body).toContain(STAMPED_LETTER_NOTE);
    expect(tuneVerdict(2500, "idle").tone).toBe("green");
    expect(tuneVerdict(2500, "idle").body).toContain(MANUAL_IDLE_NOTE);
    expect(tuneVerdict(3100, "idle").tone).toBe("green");
    expect(tuneVerdict(3101, "idle").tone).toBe("borderline");
    expect(tuneVerdict(3200, "idle").tone).toBe("borderline");
    expect(tuneVerdict(3201, "idle").tone).toBe("red");
    expect(tuneVerdict(3201, "idle").body).toContain(STAMPED_LETTER_NOTE);
  });

  it("closes full-throttle gaps at the documented boundaries for chainsaws only", () => {
    const saw = { toolType: "chainsaw" as const };
    expect(tuneVerdict(10999, "full-throttle", undefined, undefined, saw).tone).toBe("yellow");
    expect(tuneVerdict(10999, "full-throttle", undefined, undefined, saw).body).toContain(STAMPED_LETTER_NOTE);
    expect(tuneVerdict(11000, "full-throttle", undefined, undefined, saw).tone).toBe("green");
    expect(tuneVerdict(12800, "full-throttle", undefined, undefined, saw).tone).toBe("green");
    expect(tuneVerdict(12801, "full-throttle", undefined, undefined, saw).tone).toBe("yellow");
    expect(tuneVerdict(13200, "full-throttle", undefined, undefined, saw).tone).toBe("yellow");
    expect(tuneVerdict(13201, "full-throttle", undefined, undefined, saw).tone).toBe("red");
    expect(tuneVerdict(13201, "full-throttle", undefined, undefined, saw).title).toMatch(/TOO LEAN/);
    expect(tuneVerdict(13201, "full-throttle", undefined, undefined, saw).body).toContain(STAMPED_LETTER_NOTE);
  });

  it("does not apply chainsaw WOT bands to trimmers, blowers, or unknown tools without a max or model spec", () => {
    const banner = (toolType?: string) =>
      tuneVerdict(12000, "full-throttle", undefined, undefined, toolType ? { toolType } : undefined);
    for (const v of [banner("weed-eater"), banner("leaf-blower"), banner("hedge-trimmer"), banner()]) {
      expect(v.tone).toBe("info");
      expect(v.isTuningInstruction).toBe(false);
      expect(v.body).toBe(NEED_MAX_BANNER);
      expect(v.body).not.toMatch(/H screw/i);
      expect(v.body).not.toContain(STAMPED_LETTER_NOTE);
    }
    // 7,500 would look "too rich" on the chainsaw scale; a trimmer must not get that H-screw tip.
    const trimmer = tuneVerdict(7500, "full-throttle", undefined, undefined, { toolType: "weed-eater" });
    expect(trimmer.tone).toBe("info");
    expect(trimmer.body).toBe(NEED_MAX_BANNER);
  });

  it("judges full throttle against a user-entered manual max RPM", () => {
    // max 12,500 → sweet 11,000–12,000, caution 12,001–12,500, red over max
    expect(tuneVerdict(10999, "full-throttle", 12500).tone).toBe("yellow");
    expect(tuneVerdict(11000, "full-throttle", 12500).tone).toBe("green");
    expect(tuneVerdict(12000, "full-throttle", 12500).tone).toBe("green");
    expect(tuneVerdict(12001, "full-throttle", 12500).tone).toBe("yellow");
    expect(tuneVerdict(12500, "full-throttle", 12500).tone).toBe("yellow");
    expect(tuneVerdict(12501, "full-throttle", 12500).tone).toBe("red");
  });
});

describe("official model specs", () => {
  it("includes only sourced entries and matches model numbers loosely", () => {
    expect(MODEL_SPECS.length).toBeGreaterThanOrEqual(8);
    for (const spec of MODEL_SPECS) {
      expect(spec.source.url).toMatch(/^https?:\/\//);
      expect(spec.source.title.trim().length).toBeGreaterThan(0);
      expect(hasOfficialIdle(spec) || hasOfficialMax(spec) || spec.noMixtureScrews).toBe(true);
    }
    expect(findModelSpec("my echo GT 225")?.id).toBe("echo-gt-225");
    expect(findModelSpec("SRM-2620")?.id).toBe("echo-srm-2620");
    expect(findModelSpec("ECHO srm 3020t")?.id).toBe("echo-srm-3020t");
    expect(findModelSpec("ECHO SRM-3020")?.id).toBe("echo-srm-3020");
    expect(findModelSpec("srm225i")?.id).toBe("echo-srm-225i");
    expect(findModelSpec("Weed eater SRM 225")?.id).toBe("echo-srm-225");
    expect(findModelSpec("srm225")?.id).toBe("echo-srm-225");
    expect(findModelSpec("Craftsman 316.791150")?.id).toBe("craftsman-316-791150");
    expect(findModelSpec("MS 261 C-M")?.noMixtureScrews).toBe(true);
    // Current Craftsman WC215 / CMX manuals do not list RPM — do not invent a match.
    expect(findModelSpec("Craftsman WC215")?.id).toBeUndefined();
    expect(findModelSpec("CMXGTAMDZ20C")?.id).toBeUndefined();
    expect(findModelSpec("random blower")?.id).toBeUndefined();
  });

  it("uses official ECHO trimmer WOT instead of the general 11,000–12,800 band", () => {
    const gt = findModelSpec("GT-225")!;
    expect(officialMaxRpm(gt)).toBe(7500);
    // Without the official spec, 7,500 must not use the chainsaw general scale on a trimmer.
    expect(tuneVerdict(7500, "full-throttle", undefined, undefined, { toolType: "weed-eater" }).tone).toBe("info");
    expect(tuneVerdict(7500, "full-throttle", undefined, gt, { toolType: "weed-eater" }).tone).toBe("yellow"); // at max: caution (max-500 to max)
    expect(tuneVerdict(7000, "full-throttle", undefined, gt).tone).toBe("green"); // 7500-500
    expect(tuneVerdict(6000, "full-throttle", undefined, gt).tone).toBe("green"); // 7500-1500
    expect(tuneVerdict(5999, "full-throttle", undefined, gt).tone).toBe("yellow");
    expect(tuneVerdict(7501, "full-throttle", undefined, gt).tone).toBe("red");

    const srm = findModelSpec("SRM-2620")!;
    expect(tuneVerdict(10500, "full-throttle", undefined, srm).title).toMatch(/lean|TOO LEAN|Sweet/i);
    expect(tuneVerdict(9500, "full-throttle", undefined, srm).tone).toBe("green");

    const srmi = findModelSpec("SRM-225i")!;
    expect(tuneVerdict(7599, "full-throttle", undefined, srmi).tone).toBe("yellow");
    expect(tuneVerdict(7600, "full-throttle", undefined, srmi).tone).toBe("green");
    expect(tuneVerdict(8700, "full-throttle", undefined, srmi).tone).toBe("green");
    expect(tuneVerdict(8701, "full-throttle", undefined, srmi).tone).toBe("red");
  });

  it("uses official idle bands, including Craftsman 316.791150 and ECHO idle targets", () => {
    const craft = findModelSpec("316.791150")!;
    expect(idleBand(craft)).toEqual({ low: 2800, high: 3400, borderlineHigh: 3400 });
    expect(tuneVerdict(2799, "idle", undefined, craft).tone).toBe("yellow");
    expect(tuneVerdict(2800, "idle", undefined, craft).tone).toBe("green");
    expect(tuneVerdict(3400, "idle", undefined, craft).tone).toBe("green");
    expect(tuneVerdict(3401, "idle", undefined, craft).tone).toBe("red");

    const gt = findModelSpec("GT-225")!;
    // 3,000 ± 200 locked; 3,201–3,300 borderline; 3,301 too high
    expect(tuneVerdict(2799, "idle", undefined, gt).tone).toBe("yellow");
    expect(tuneVerdict(2800, "idle", undefined, gt).tone).toBe("green");
    expect(tuneVerdict(3200, "idle", undefined, gt).tone).toBe("green");
    expect(tuneVerdict(3201, "idle", undefined, gt).tone).toBe("borderline");
    expect(tuneVerdict(3300, "idle", undefined, gt).tone).toBe("borderline");
    expect(tuneVerdict(3301, "idle", undefined, gt).tone).toBe("red");
  });

  it("omits official WOT for SRM-225 because manuals disagree, and does not invent CMX RPM", () => {
    const srm = findModelSpec("SRM-225")!;
    expect(hasOfficialIdle(srm)).toBe(true);
    expect(hasOfficialMax(srm)).toBe(false);
    expect(srm.note).toMatch(/WOT/i);
  });
});

describe("peak detection on synthetic engine sounds", () => {
  const sr = 44100;

  it("recovers firing frequency with autocorrelation and combined estimate", () => {
    const cases = [
      { hz: 50, rpm: 3000 },
      { hz: 100, rpm: 6000 },
      { hz: 175, rpm: 10500 },
    ];
    for (const { hz, rpm } of cases) {
      const wave = syntheticEngineWave(hz, sr, 0.45, { amplitude: 0.7, harmonic2: 0.3 });
      const ac = firingHzFromAutocorr(wave, sr);
      expect(ac).not.toBeNull();
      expect(Math.abs(ac!.hz - hz) / hz).toBeLessThan(0.04);
      const spec = { magnitudes: magnitudeSpectrum(wave, 4096), fftSize: 4096 };
      const est = estimateFiring(wave, sr, spec);
      expect(est).not.toBeNull();
      expect(Math.abs(est!.rpm - rpm) / rpm).toBeLessThan(0.05);
    }
  });

  it("returns no estimate for a weak or silent signal", () => {
    const silence = new Float32Array(8192);
    expect(firingHzFromAutocorr(silence, 44100)).toBeNull();
    expect(estimateFiring(silence, 44100)).toBeNull();
    const faint = syntheticEngineWave(80, 44100, 0.3, { amplitude: 0.005, harmonic2: 0, noise: 0 });
    expect(estimateFiring(faint, 44100)).toBeNull();
  });
});

describe("Ask Mechanic tuner hook", () => {
  it("maps the Listen to my engine chip to the tuner and includes the letter note", () => {
    expect(QUICK_CHIPS).toContain("Listen to my engine");
    expect(detectIntent("Listen to my engine")).toBe("rpm-tuner");
    const r = replyTo("Listen to my engine");
    expect(r.intent).toBe("rpm-tuner");
    expect(r.text).toMatch(/never recorded or uploaded/i);
    expect(r.text).toContain(STAMPED_LETTER_NOTE);
    expect(r.links.some((l) => l.tab === "carb" && l.focus === "tuner")).toBe(true);
  });
});

describe("4-stroke mode and governed speed", () => {
  it("uses Hz × 120 and never gives H-screw advice", () => {
    const v = tuneVerdict(3600, "full-throttle", undefined, undefined, { cycle: "4-stroke" });
    expect(v.tone).toBe("info");
    expect(v.isTuningInstruction).toBe(false);
    expect(v.body).toMatch(/Hz × 120/);
    expect(v.body).toMatch(/No H-screw advice/i);
    expect(v.body).not.toContain(STAMPED_LETTER_NOTE);
    // Even a chainsaw-level RPM must not trigger the 2-stroke lean/H-screw verdict.
    const high = tuneVerdict(13500, "full-throttle", undefined, undefined, { cycle: "4-stroke", toolType: "chainsaw" });
    expect(high.isTuningInstruction).toBe(false);
    expect(high.body).not.toMatch(/H screw/i);
  });

  it("compares full throttle to a user-entered governed speed without screw tips", () => {
    const ctx = { cycle: "4-stroke" as const };
    expect(tuneVerdict(3300, "full-throttle", 3600, undefined, ctx).tone).toBe("info");
    expect(tuneVerdict(3400, "full-throttle", 3600, undefined, ctx).tone).toBe("green");
    expect(tuneVerdict(3600, "full-throttle", 3600, undefined, ctx).tone).toBe("green");
    const over = tuneVerdict(3601, "full-throttle", 3600, undefined, ctx);
    expect(over.tone).toBe("red");
    expect(over.isTuningInstruction).toBe(false);
    expect(over.body).not.toMatch(/H screw/i);
    expect(over.title).toMatch(/governed/i);
  });

  it("recovers a 4-stroke firing frequency as Hz × 120", () => {
    const sr = 44100;
    const hz = 30; // 3,600 RPM on a 4-stroke
    const wave = syntheticEngineWave(hz, sr, 0.45, { amplitude: 0.7, harmonic2: 0.3 });
    const est = estimateFiring(wave, sr, { magnitudes: magnitudeSpectrum(wave, 4096), fftSize: 4096 }, "4-stroke");
    expect(est).not.toBeNull();
    expect(Math.abs(est!.rpm - 3600) / 3600).toBeLessThan(0.05);
  });
});

describe("app version cache", () => {
  it("bumps the service worker cache with the app version", () => {
    expect(APP_VERSION).toBe("1.3.1");
    const sw = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");
    expect(sw).toContain(`const CACHE = "crankit-v${APP_VERSION}"`);
  });
});
