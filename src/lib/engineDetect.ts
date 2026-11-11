import type { ModelSpec } from "../data/modelSpecs";
import { MODEL_SPECS, officialMaxRpm } from "../data/modelSpecs";
import { officialIdleTarget, officialWotTarget } from "./engineSanity";
import { detectOnsets } from "./missDetect";
import {
  estimateFiring,
  hzToRpm,
  magnitudeSpectrum,
  median,
  rms,
  type EngineCycle,
} from "./rpmMath";

export const AUTO_DETECT_SECONDS = 5;
export const UNSURE_ENGINE = "Not sure — pick your engine";
export const LOW_CONFIDENCE = 0.45;

export type CylinderGuess = "single" | "twin" | "multi";
export type RevStyle = "governed" | "free-revving" | "unknown";

export type EngineGuess = {
  cycle: EngineCycle | null;
  cylinders: CylinderGuess | null;
  style: RevStyle;
  rpm: number | null;
  firingHz: number | null;
  confidence: number;
  summary: string;
  lowConfidence: boolean;
  matches: ModelSpec[];
};

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}


function peakNear(mags: ArrayLike<number>, fftSize: number, sampleRate: number, hz: number): number {
  const binHz = sampleRate / fftSize;
  const bin = Math.round(hz / binHz);
  let m = 0;
  for (let i = Math.max(1, bin - 2); i <= Math.min(mags.length - 1, bin + 2); i++) {
    const v = mags[i] ?? 0;
    if (v > m) m = v;
  }
  return m;
}

function cycleOf(spec: ModelSpec): EngineCycle {
  return spec.engineCycle === "4-stroke" ? "4-stroke" : "2-stroke";
}

/**
 * Classify a short on-device recording. Does not pick a model — only a guess
 * plus a shortlist for the user to tap.
 */
export function classifyEngine(
  samples: ArrayLike<number>,
  sampleRate: number,
  rpmSeries: number[] = [],
): EngineGuess {
  if (rms(samples) < 0.04) return unsure();
  const spec4 = { magnitudes: magnitudeSpectrum(samples, 4096), fftSize: 4096 };
  const est4 = estimateFiring(samples, sampleRate, spec4, "4-stroke");
  const est2 = estimateFiring(samples, sampleRate, spec4, "2-stroke");

  const onsets = detectOnsets(samples, sampleRate, est4 && (!est2 || (est4.confidence >= (est2.confidence ?? 0) * 0.8)) ? "4-stroke" : "2-stroke");
  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i++) intervals.push(onsets[i] - onsets[i - 1]);
  const medI = intervals.length ? median(intervals) : Number.NaN;
  const cv = medI > 0 ? stdev(intervals) / medI : 1;

  const hz2 = est2?.hz;
  const hz4 = est4?.hz;
  // Prefer the estimate whose implied RPM is in a plausible band.
  let cycle: EngineCycle | null = null;
  let hz: number | null = null;
  let confidence = 0;
  let cylinders: CylinderGuess = "single";

  const plausible2 = (h: number) => {
    const rpm = hzToRpm(h, "2-stroke");
    return rpm >= 1800 && rpm <= 16000;
  };
  const plausible4 = (h: number) => {
    const rpm = hzToRpm(h, "4-stroke");
    return rpm >= 900 && rpm <= 5500;
  };

  // Even-fire 4-stroke twin: two pulses per crank rev → ~60 Hz at 3,600 RPM,
  // with a half-rate (crank) component around 30 Hz.
  const fast = [hz2, hz4].filter((h): h is number => h != null).sort((a, b) => b - a)[0];
  const halfFromSpectrum =
    fast != null &&
    fast >= 45 &&
    fast <= 80 &&
    (() => {
      const fund = peakNear(spec4.magnitudes, 4096, sampleRate, fast);
      const half = peakNear(spec4.magnitudes, 4096, sampleRate, fast / 2);
      return fund > 0 && half / fund >= 0.18;
    })();
  const twinPair =
    (hz2 != null &&
      hz4 != null &&
      hz2 >= 45 &&
      hz2 <= 80 &&
      Math.abs(hz2 - hz4 * 2) / hz2 < 0.12) ||
    halfFromSpectrum;

  if (twinPair && (hz2 != null || fast != null)) {
    cycle = "4-stroke";
    hz = (hz2 != null && hz2 >= 45 ? hz2 : fast) ?? hz2 ?? hz4;
    cylinders = "twin";
    confidence = 0.78;
  } else if (hz2 != null && hz2 >= 80 && plausible2(hz2)) {
    // Above ~80 Hz a 4-stroke mapping would be >9,600 RPM — almost certainly 2-stroke.
    cycle = "2-stroke";
    hz = hz2;
    confidence = 0.86;
  } else if (hz4 != null && hz4 <= 22 && plausible4(hz4)) {
    cycle = "4-stroke";
    hz = hz4;
    confidence = 0.8;
  } else if (hz4 != null && hz4 >= 24 && hz4 <= 40 && plausible4(hz4) && !(hz2 != null && hz2 >= 45 && hz2 <= 60 && plausible2(hz2) && cv > 0.06)) {
    // 24–40 Hz is classic 4-stroke governed (2,880–4,800 RPM) and below typical 2-stroke idle.
    cycle = "4-stroke";
    hz = hz4;
    confidence = cv < 0.04 ? 0.84 : 0.7;
  } else if (hz2 != null && hz2 >= 42 && hz2 <= 70 && plausible2(hz2)) {
    cycle = "2-stroke";
    hz = hz2;
    confidence = 0.72;
  } else if (hz2 != null && plausible2(hz2) && (hz4 == null || !plausible4(hz4) || (est2 && est4 && est2.confidence >= est4.confidence))) {
    cycle = "2-stroke";
    hz = hz2;
    confidence = 0.55;
  } else if (hz4 != null && plausible4(hz4)) {
    cycle = "4-stroke";
    hz = hz4;
    confidence = 0.55;
  }

  if (hz == null || cycle == null) {
    return unsure();
  }

  if (cycle === "2-stroke" && intervals.length > 10 && cylinders === "single") {
    const midT = median(intervals);
    const alt: number[] = [];
    for (let i = 0; i + 1 < intervals.length; i += 2) alt.push(intervals[i] / (intervals[i + 1] || midT));
    const uneven = alt.length && stdev(alt) > 0.12;
    if (uneven && midT > 0) cylinders = "twin";
  }
  if (cycle === "4-stroke" && cylinders === "single" && hz >= 80 && hz <= 120) {
    cylinders = "multi";
    confidence = Math.min(confidence, 0.6);
  }

  // Twin / multi 4-stroke: firing Hz is cylinders × crank / 120, so crank RPM = Hz × 60 for a twin.
  let displayRpm = hzToRpm(hz, cycle);
  if (cycle === "4-stroke" && (cylinders === "twin" || cylinders === "multi") && hz >= 45) {
    displayRpm = hz * 60;
  }

  const series = rpmSeries.length >= 4 ? rpmSeries : [];
  const seriesCv = series.length ? stdev(series) / (median(series) || 1) : cv;

  let style: RevStyle = "unknown";
  if (cycle === "4-stroke" && displayRpm >= 2800 && displayRpm <= 4500 && seriesCv < 0.035) {
    style = "governed";
    confidence = Math.min(0.95, confidence + 0.08);
  } else if (cycle === "2-stroke" && displayRpm >= 6000 && seriesCv < 0.08) {
    style = "free-revving";
  } else if (cycle === "4-stroke" && displayRpm >= 2800 && seriesCv >= 0.06) {
    style = "free-revving";
  } else if (cycle === "2-stroke" && displayRpm <= 4000) {
    style = "unknown";
  } else if (seriesCv < 0.03 && displayRpm >= 2800) {
    style = cycle === "4-stroke" ? "governed" : "free-revving";
  }

  if (confidence < LOW_CONFIDENCE) {
    const blank = unsure();
    blank.rpm = displayRpm;
    blank.firingHz = hz;
    return blank;
  }

  const guess: EngineGuess = {
    cycle,
    cylinders,
    style,
    rpm: displayRpm,
    firingHz: hz,
    confidence,
    summary: summarize(cycle, cylinders, style, displayRpm, confidence),
    lowConfidence: false,
    matches: [],
  };
  guess.matches = shortlistEngines(guess);
  return guess;
}

function unsure(): EngineGuess {
  return {
    cycle: null,
    cylinders: null,
    style: "unknown",
    rpm: null,
    firingHz: null,
    confidence: 0,
    summary: UNSURE_ENGINE,
    lowConfidence: true,
    matches: [],
  };
}

export function summarize(
  cycle: EngineCycle | null,
  cylinders: CylinderGuess | null,
  style: RevStyle,
  rpm: number | null,
  confidence: number,
): string {
  if (!cycle || confidence < LOW_CONFIDENCE) return UNSURE_ENGINE;
  const cyl =
    cylinders === "twin" ? "twin-cylinder" : cylinders === "multi" ? "multi-cylinder" : "single-cylinder";
  const rpmBit = rpm != null ? ` ~${(Math.round(rpm / 50) * 50).toLocaleString("en-US")} RPM` : "";
  const styleBit = style === "governed" ? `, governed${rpmBit}` : style === "free-revving" ? `, free-revving${rpmBit}` : rpmBit ? `,${rpmBit}` : "";
  return `Sounds like a ${cyl} ${cycle}${styleBit}`;
}

export function shortlistEngines(guess: EngineGuess, catalog: readonly ModelSpec[] = MODEL_SPECS): ModelSpec[] {
  if (guess.lowConfidence || !guess.cycle || guess.rpm == null) return [];
  const rpm = guess.rpm;
  const scored: { spec: ModelSpec; d: number }[] = [];
  for (const spec of catalog) {
    if (cycleOf(spec) !== guess.cycle) continue;
    const idle = officialIdleTarget(spec);
    const wot = officialWotTarget(spec) ?? officialMaxRpm(spec);
    let target: number | undefined;
    if (guess.cycle === "4-stroke") {
      if (rpm >= 2600) target = wot;
      else if (rpm <= 2200) target = idle;
      else target = wot ?? idle;
    } else {
      if (rpm >= 5000) target = wot;
      else if (rpm <= 4000) target = idle;
      else target = wot ?? idle;
    }
    if (target == null) continue;
    const d = Math.abs(rpm - target) / target;
    if (d <= 0.14) scored.push({ spec, d });
  }
  scored.sort((a, b) => a.d - b.d);
  // Unique, top 5.
  const out: ModelSpec[] = [];
  for (const row of scored) {
    if (!out.some((s) => s.id === row.spec.id)) out.push(row.spec);
    if (out.length >= 5) break;
  }
  return out;
}

/** Stable 4-stroke or 2-stroke tone for auto-detect tests (optional extra cylinders). */
export function syntheticDetectWave(
  cycle: EngineCycle,
  rpm: number,
  sampleRate: number,
  seconds: number,
  opts: { cylinders?: 1 | 2 | 3; governed?: boolean; amplitude?: number } = {},
): Float32Array {
  const cyl = opts.cylinders ?? 1;
  const firingsPerRev = cycle === "4-stroke" ? cyl / 2 : cyl;
  const firingHz = (rpm / 60) * firingsPerRev;
  const n = Math.floor(sampleRate * seconds);
  const out = new Float32Array(n);
  const amp = opts.amplitude ?? 0.75;
  const wobble = opts.governed ? 0.004 : 0.03;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const inst = firingHz * (1 + wobble * Math.sin(2 * Math.PI * 1.4 * t));
    let v = Math.sin(2 * Math.PI * inst * t) + 0.28 * Math.sin(4 * Math.PI * inst * t);
    // Even-fire twin: firing stays at inst Hz, with mild crank-rate amplitude modulation.
    if (cyl >= 2) v *= 1 + 0.28 * Math.sin(2 * Math.PI * (inst / cyl) * t);
    out[i] = amp * v;
  }
  return out;
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}% confident`;
}

