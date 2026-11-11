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
  it("converts firing frequency to RPM as Hz × 60", () => {
    expect(hzToRpm(50)).toBe(3000);
    expect(hzToRpm(200)).toBe(12000);
    expect(rpmToHz(7500)).toBe(125);
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
    expect(tuneVerdict(3100, "idle").tone).toBe("green");
    expect(tuneVerdict(3101, "idle").tone).toBe("borderline");
    expect(tuneVerdict(3200, "idle").tone).toBe("borderline");
    expect(tuneVerdict(3201, "idle").tone).toBe("red");
    expect(tuneVerdict(3201, "idle").body).toContain(STAMPED_LETTER_NOTE);
  });

  it("closes full-throttle gaps at the documented boundaries", () => {
    expect(tuneVerdict(10999, "full-throttle").tone).toBe("yellow");
    expect(tuneVerdict(10999, "full-throttle").body).toContain(STAMPED_LETTER_NOTE);
    expect(tuneVerdict(11000, "full-throttle").tone).toBe("green");
    expect(tuneVerdict(12800, "full-throttle").tone).toBe("green");
    expect(tuneVerdict(12801, "full-throttle").tone).toBe("yellow");
    expect(tuneVerdict(13200, "full-throttle").tone).toBe("yellow");
    expect(tuneVerdict(13201, "full-throttle").tone).toBe("red");
    expect(tuneVerdict(13201, "full-throttle").title).toMatch(/TOO LEAN/);
    expect(tuneVerdict(13201, "full-throttle").body).toContain(STAMPED_LETTER_NOTE);
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
    // 7,500 is "too rich" on the general scale, but it is this model's official WOT.
    expect(tuneVerdict(7500, "full-throttle").tone).toBe("yellow");
    expect(tuneVerdict(7500, "full-throttle", undefined, gt).tone).toBe("yellow"); // at max: caution (max-500 to max)
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

describe("app version cache", () => {
  it("bumps the service worker cache with the app version", () => {
    expect(APP_VERSION).toBe("1.3.0");
    const sw = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");
    expect(sw).toContain(`const CACHE = "crankit-v${APP_VERSION}"`);
  });
});
