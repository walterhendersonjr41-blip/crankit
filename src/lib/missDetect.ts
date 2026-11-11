import { firingBand, type EngineCycle, type TuneMode } from "./rpmMath";

export type MissPattern = "healthy" | "regular-skip" | "surge" | "rich-burble" | "bog" | "hot-coil" | "irregular";

export type MissReport = {
  missRate: number;
  pattern: MissPattern;
  patternLabel: string;
  likelyCause: string;
  intervalCv: number;
  expectedIntervalMs: number | null;
  onsetCount: number;
};

export const LIKELY_NOT_CERTAIN =
  "This is a likely cause, not a certainty. Confirm with a visual check before you buy parts.";

const CAUSES: Record<MissPattern, { label: string; cause: string }> = {
  healthy: {
    label: "Even firing",
    cause: `No clear missed pulses. Keep listening for changes when the engine is hot. ${LIKELY_NOT_CERTAIN}`,
  },
  "regular-skip": {
    label: "Steady, regular skips",
    cause:
      `Most likely spark — cheapest checks first: inspect the spark plug, then the plug wire and boot, then the coil. ${LIKELY_NOT_CERTAIN}`,
  },
  surge: {
    label: "Surging up and down at high speed",
    cause:
      `Most likely lean — cheapest checks first: fuel filter, fuel line, air leak at the intake, then a dirty carb. ${LIKELY_NOT_CERTAIN}`,
  },
  "rich-burble": {
    label: "Rough 4-stroke burble that won’t clean up",
    cause:
      `Most likely rich — cheapest checks first: clean or replace the air filter, then the muffler spark-arrestor screen. ${LIKELY_NOT_CERTAIN}`,
  },
  bog: {
    label: "Bog or stall when the throttle opens",
    cause:
      `Most likely the low-speed circuit or carb diaphragm — cheapest checks first: look at the diaphragm and the low-speed passages/screw before a full carb rebuild. ${LIKELY_NOT_CERTAIN}`,
  },
  "hot-coil": {
    label: "Misses that worsen when the engine is hot",
    cause:
      `Most likely a heat-failing coil — cheapest checks first: confirm the miss shows up after a heat-soak, then test or swap the coil (after a good plug and boot). ${LIKELY_NOT_CERTAIN}`,
  },
  irregular: {
    label: "Irregular firing",
    cause:
      `Firing intervals are uneven, but the pattern isn’t clear. Start with the cheapest checks: spark plug, air filter, and fuel filter. ${LIKELY_NOT_CERTAIN}`,
  },
};

export function formatMissRate(rate: number): string {
  const pct = Math.max(0, rate) * 100;
  return `${pct.toFixed(pct >= 10 ? 0 : 1)}%`;
}

export function envelopeEnergies(samples: ArrayLike<number>, sampleRate: number, hopMs = 2, winMs = 4): Float32Array {
  const hop = Math.max(1, Math.floor((sampleRate * hopMs) / 1000));
  const win = Math.max(hop, Math.floor((sampleRate * winMs) / 1000));
  const n = Math.max(0, Math.floor((samples.length - win) / hop) + 1);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const start = i * hop;
    let sum = 0;
    for (let j = 0; j < win; j++) {
      const v = samples[start + j] ?? 0;
      sum += v * v;
    }
    out[i] = Math.sqrt(sum / win);
  }
  return out;
}

/** Onset times in seconds from an energy envelope peak-pick. */
export function detectOnsets(
  samples: ArrayLike<number>,
  sampleRate: number,
  cycle: EngineCycle = "2-stroke",
): number[] {
  const hopMs = cycle === "4-stroke" ? 3 : 1;
  const winMs = cycle === "4-stroke" ? 6 : 2;
  const hop = Math.max(1, Math.floor((sampleRate * hopMs) / 1000));
  const energy = envelopeEnergies(samples, sampleRate, hopMs, winMs);
  if (energy.length < 8) return [];
  const sorted = [...energy].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const peak = energy.reduce((m, v) => (v > m ? v : m), 0);
  const thresh = Math.max(med * 1.5, peak * 0.18, 1e-4);
  const { maxHz } = firingBand(cycle);
  const minGap = 0.55 / maxHz;
  const times: number[] = [];
  for (let i = 1; i < energy.length - 1; i++) {
    if (energy[i] < thresh) continue;
    if (energy[i] < energy[i - 1] || energy[i] < energy[i + 1]) continue;
    const t = (i * hop) / sampleRate;
    if (times.length && t - times[times.length - 1] < minGap) {
      // Keep the stronger peak.
      const prevI = Math.round((times[times.length - 1] * sampleRate) / hop);
      if (energy[i] > (energy[prevI] ?? 0)) times[times.length - 1] = t;
      continue;
    }
    times.push(t);
  }
  return times;
}

function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(v);
}

export function analyzeIntervals(
  onsets: number[],
  opts: { mode?: TuneMode; engineHot?: boolean; previousMissRate?: number } = {},
): MissReport {
  const empty: MissReport = {
    missRate: 0,
    pattern: "healthy",
    patternLabel: CAUSES.healthy.label,
    likelyCause: CAUSES.healthy.cause,
    intervalCv: 0,
    expectedIntervalMs: null,
    onsetCount: onsets.length,
  };
  if (onsets.length < 6) return { ...empty, pattern: "irregular", patternLabel: CAUSES.irregular.label, likelyCause: CAUSES.irregular.cause };

  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i++) intervals.push(onsets[i] - onsets[i - 1]);
  const T = median(intervals);
  if (!Number.isFinite(T) || T <= 0) return empty;

  const nearT: number[] = [];
  let doubleMiss = 0;
  let tripleMiss = 0;
  let inBetween = 0;
  let expectedPulses = 0;
  for (const d of intervals) {
    const ratio = d / T;
    if (ratio < 1.45) {
      nearT.push(d);
      expectedPulses += 1;
      if (ratio > 1.2 && ratio < 1.45) inBetween += 1;
    } else if (ratio < 2.45) {
      doubleMiss += 1;
      expectedPulses += 2;
    } else if (ratio < 3.5) {
      tripleMiss += 1;
      expectedPulses += 3;
    } else {
      expectedPulses += Math.max(1, Math.round(ratio));
    }
  }
  const missRate = expectedPulses > 0 ? Math.max(0, Math.min(1, (doubleMiss + tripleMiss * 2) / expectedPulses)) : 0;
  const cv = T > 0 ? stdev(nearT.length >= 3 ? nearT : intervals) / T : 0;

  // Slow wander of the local period (surge), vs random jitter.
  const window = Math.max(5, Math.floor(intervals.length / 8));
  const run: number[] = [];
  for (let i = 0; i + window <= intervals.length; i++) {
    run.push(median(intervals.slice(i, i + window)));
  }
  const runCv = run.length > 2 && T > 0 ? stdev(run) / T : 0;
  const midJitter = inBetween / Math.max(1, intervals.length);
  const doubleFrac = doubleMiss / Math.max(1, intervals.length);

  // Early-interval stretch (bog on throttle): first beats much longer than the later median.
  const headN = Math.max(3, Math.floor(intervals.length * 0.2));
  const tailN = Math.max(3, Math.floor(intervals.length * 0.4));
  const early = median(intervals.slice(0, headN));
  const later = median(intervals.slice(Math.max(headN, intervals.length - tailN)));
  const boggy = opts.mode !== "idle" && later > 0 && early / later > 1.35;

  let pattern: MissPattern = "healthy";
  if (opts.engineHot && missRate >= 0.04 && (opts.previousMissRate == null || missRate > opts.previousMissRate + 0.02)) {
    pattern = "hot-coil";
  } else if (boggy && (missRate < 0.5 || early / later > 1.8)) {
    pattern = "bog";
  } else if (doubleFrac >= 0.12 && cv < 0.12 && midJitter < 0.18) {
    pattern = "regular-skip";
  } else if (opts.mode === "full-throttle" && runCv >= 0.04 && runCv > cv * 0.7 && missRate < 0.2) {
    pattern = "surge";
  } else if (opts.mode === "full-throttle" && (cv >= 0.08 || midJitter >= 0.12) && doubleFrac < 0.28) {
    pattern = "rich-burble";
  } else if (missRate >= 0.04 || cv >= 0.1) {
    pattern = "irregular";
  }

  // If misses are present and the user marked the engine hot, prefer the heat-failing coil story when no tighter pattern won hard.
  if (opts.engineHot && missRate >= 0.06 && (pattern === "irregular" || pattern === "healthy" || pattern === "regular-skip")) {
    pattern = "hot-coil";
  }

  const info = CAUSES[pattern];
  return {
    missRate,
    pattern,
    patternLabel: info.label,
    likelyCause: info.cause,
    intervalCv: cv,
    expectedIntervalMs: T * 1000,
    onsetCount: onsets.length,
  };
}

export function analyzeMisses(
  samples: ArrayLike<number>,
  sampleRate: number,
  opts: { cycle?: EngineCycle; mode?: TuneMode; engineHot?: boolean; previousMissRate?: number } = {},
): MissReport {
  const onsets = detectOnsets(samples, sampleRate, opts.cycle ?? "2-stroke");
  return analyzeIntervals(onsets, opts);
}

export type SimMissPattern = Exclude<MissPattern, "irregular">;

/** Build a synthetic firing wave so the tuner simulator can demo miss patterns. */
export function syntheticMissWave(
  pattern: SimMissPattern,
  firingHz: number,
  sampleRate: number,
  seconds: number,
  opts: { amplitude?: number } = {},
): Float32Array {
  const amp = opts.amplitude ?? 0.7;
  const n = Math.floor(sampleRate * seconds);
  const out = new Float32Array(n);
  const period = 1 / Math.max(1, firingHz);
  const pulseLen = Math.max(8, Math.floor(sampleRate * 0.0025));
  let tEvent = 0;
  let cycle = 0;
  while (tEvent < seconds) {
    let instPeriod = period;
    let skip = false;
    if (pattern === "surge") {
      instPeriod = period / (1 + 0.1 * Math.sin(2 * Math.PI * 2 * tEvent));
    } else if (pattern === "rich-burble") {
      instPeriod = period / (1 + 0.09 * Math.sin(2 * Math.PI * firingHz * 0.5 * tEvent) + 0.08 * Math.sin(2 * Math.PI * 13 * tEvent) + 0.05 * Math.sin(2 * Math.PI * 7 * tEvent));
    } else if (pattern === "bog") {
      const ramp = Math.min(1, Math.max(0, (tEvent - 0.45) / 0.35));
      let instHz = firingHz * (0.35 + 0.65 * ramp * ramp);
      if (tEvent < 0.45) instHz = firingHz * 0.35;
      instPeriod = 1 / Math.max(8, instHz);
    } else if (pattern === "regular-skip") {
      if (cycle % 4 === 3) skip = true;
    } else if (pattern === "hot-coil") {
      const pSkip = Math.min(0.4, (tEvent / seconds) * 0.5);
      const hash = (cycle * 1103515245 + 12345) >>> 0;
      if (hash / 0xffffffff < pSkip) skip = true;
    }
    if (!skip) {
      const start = Math.floor(tEvent * sampleRate);
      for (let k = 0; k < pulseLen && start + k < n; k++) {
        const env = Math.exp(-k / (pulseLen * 0.22));
        out[start + k] += amp * env;
      }
    }
    tEvent += instPeriod;
    cycle += 1;
  }
  return out;
}

export function firingHzForRpm(rpm: number, cycle: EngineCycle = "2-stroke"): number {
  return rpm / (cycle === "4-stroke" ? 120 : 60);
}
