import { STAMPED_LETTER_NOTE } from "../data/carbNotes";
import type { ModelSpec } from "../data/modelSpecs";
import { hasOfficialIdle, hasOfficialMax, officialMaxRpm } from "../data/modelSpecs";

/** 2-stroke firing search band: 25 Hz = 1,500 RPM, 250 Hz = 15,000 RPM. */
export const MIN_FIRING_HZ = 25;
export const MAX_FIRING_HZ = 250;

export const RANGE_NOTE =
  "Idle ranges are general for 2-stroke tools — your manual's idle RPM wins if it lists one. The general full-throttle band (about 11,000–12,800 RPM) is for chainsaws only. For trimmers, blowers, and unknown tools, enter your manual's max RPM or pick a verified model before any H-screw advice. Phone mics can misread—confirm with a tach if unsure. Many carbs have limiter caps; never force a screw.";

export const NEED_MAX_BANNER =
  "Enter your manual's max RPM (or pick your model) to get a safe H-screw verdict.";

export const MANUAL_IDLE_NOTE =
  "These idle ranges are general — your manual's idle RPM wins if it lists one.";

export const LIMITER_H_NOTE =
  "On many EPA and limiter-cap carbs, the stamped H (and L) screws only move a fraction of a turn. Do not pry a cap off just to chase a number. If H barely turns, check the air filter and the muffler spark-arrestor first, then follow the manual.";

export const ELECTRONIC_CARB_NOTE =
  "This tool may have no user mixture screws — for example STIHL M-Tronic or Husqvarna AutoTune. Use the RPM reading as a check only. Do not force or look for screws that are not there. Check your manual.";

export type TuneMode = "idle" | "full-throttle";
export type EngineCycle = "2-stroke" | "4-stroke";
export type VerdictTone = "green" | "borderline" | "yellow" | "red" | "info";

export type TuneContext = {
  toolType?: string;
  cycle?: EngineCycle;
};

export type TuneVerdict = {
  tone: VerdictTone;
  title: string;
  body: string;
  /** True when the user is told to turn a screw. */
  isTuningInstruction: boolean;
};

export function hzToRpm(hz: number, cycle: EngineCycle = "2-stroke"): number {
  return hz * (cycle === "4-stroke" ? 120 : 60);
}

export function rpmToHz(rpm: number, cycle: EngineCycle = "2-stroke"): number {
  return rpm / (cycle === "4-stroke" ? 120 : 60);
}

/** 2-stroke: 25–250 Hz (1,500–15,000 RPM). 4-stroke: 8–80 Hz (960–9,600 RPM). */
export function firingBand(cycle: EngineCycle = "2-stroke"): { minHz: number; maxHz: number } {
  if (cycle === "4-stroke") return { minHz: 8, maxHz: 80 };
  return { minHz: MIN_FIRING_HZ, maxHz: MAX_FIRING_HZ };
}

export function isChainsawTool(toolType?: string): boolean {
  return toolType === "chainsaw";
}

/** General 11,000–13,200 WOT bands are chainsaw-only, and never used in 4-stroke mode. */
export function canUseGeneralWot(ctx?: TuneContext): boolean {
  if ((ctx?.cycle ?? "2-stroke") === "4-stroke") return false;
  return isChainsawTool(ctx?.toolType);
}

export function hasWotAnchor(maxRpm?: number, spec?: ModelSpec, cycle: EngineCycle = "2-stroke"): boolean {
  if (parseMaxRpm(maxRpm, cycle) != null) return true;
  return cycle === "2-stroke" && hasOfficialMax(spec);
}

export function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function ema(prev: number | null, next: number, alpha = 0.28): number {
  if (prev == null || Number.isNaN(prev)) return next;
  return prev * (1 - alpha) + next * alpha;
}

export function normalizeWave(samples: ArrayLike<number>): Float32Array {
  const out = new Float32Array(samples.length);
  if (samples.length === 0) return out;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min >= -1.5 && max <= 1.5) {
    for (let i = 0; i < samples.length; i++) out[i] = samples[i];
    return out;
  }
  if (min >= 0 && max <= 255) {
    for (let i = 0; i < samples.length; i++) out[i] = (samples[i] - 128) / 128;
    return out;
  }
  const mid = (min + max) / 2;
  const amp = Math.max(1e-6, (max - min) / 2);
  for (let i = 0; i < samples.length; i++) out[i] = (samples[i] - mid) / amp;
  return out;
}

export function rms(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

function autocorrAt(samples: ArrayLike<number>, lag: number): number {
  let sum = 0;
  const n = samples.length - lag;
  if (n <= 0) return 0;
  for (let i = 0; i < n; i++) sum += samples[i] * samples[i + lag];
  return sum / n;
}

export function firingHzFromAutocorr(
  samples: ArrayLike<number>,
  sampleRate: number,
  minHz = MIN_FIRING_HZ,
  maxHz = MAX_FIRING_HZ,
): { hz: number; score: number } | null {
  const wave = normalizeWave(samples);
  const level = rms(wave);
  if (level < 0.04) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxLag = Math.min(wave.length - 3, Math.ceil(sampleRate / minHz));
  if (maxLag <= minLag + 2) return null;

  // Precompute the lag series so we can take the first strong local peak
  // (the fundamental). A clean period also correlates at 2T, 3T, …, and the
  // raw global max often lands on a long-period subharmonic or the 25 Hz floor.
  const corr = new Float32Array(maxLag + 2);
  let best = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const c = autocorrAt(wave, lag);
    corr[lag] = c;
    if (c > best) best = c;
  }
  const energy = level * level;
  const thresh = best * 0.85;
  let bestLag = minLag;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (corr[lag] >= thresh && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) {
      bestLag = lag;
      break;
    }
  }

  const y1 = bestLag > minLag ? corr[bestLag - 1] : corr[bestLag];
  const y2 = corr[bestLag];
  const y3 = bestLag < maxLag ? corr[bestLag + 1] : corr[bestLag];
  const denom = y1 - 2 * y2 + y3;
  const delta = Math.abs(denom) > 1e-12 ? (y1 - y3) / (2 * denom) : 0;
  const lag = bestLag + Math.max(-0.49, Math.min(0.49, delta));
  const hz = sampleRate / lag;
  if (hz < minHz || hz > maxHz) return null;
  const score = best / (energy + 1e-12);
  if (score < 0.22) return null;
  return { hz, score };
}

/**
 * Peak-pick a magnitude spectrum in the firing band and prefer a fundamental
 * that is supported by its harmonics (so a strong 2nd harmonic is not mistaken
 * for the firing frequency).
 */
export function firingHzFromSpectrum(
  magnitudes: ArrayLike<number>,
  sampleRate: number,
  fftSize: number,
  minHz = MIN_FIRING_HZ,
  maxHz = MAX_FIRING_HZ,
): { hz: number; score: number } | null {
  if (magnitudes.length < 8 || fftSize <= 0) return null;
  const binHz = sampleRate / fftSize;
  const i0 = Math.max(1, Math.floor(minHz / binHz));
  const i1 = Math.min(magnitudes.length - 2, Math.ceil(maxHz / binHz));
  if (i1 <= i0) return null;

  let peakI = i0;
  let peak = -Infinity;
  let sum = 0;
  for (let i = i0; i <= i1; i++) {
    const v = magnitudes[i];
    sum += v;
    if (v > peak) {
      peak = v;
      peakI = i;
    }
  }
  const mean = sum / (i1 - i0 + 1);
  if (peak < mean * 2.2 || peak <= 0) return null;

  const candidates: { hz: number; strength: number }[] = [];
  for (let harmonic = 1; harmonic <= 4; harmonic++) {
    const fundI = peakI / harmonic;
    const fundHz = fundI * binHz;
    if (fundHz < minHz || fundHz > maxHz) continue;
    const lo = Math.max(i0, Math.round(fundI) - 1);
    const hi = Math.min(i1, Math.round(fundI) + 1);
    let fund = 0;
    for (let i = lo; i <= hi; i++) fund = Math.max(fund, magnitudes[i]);
    let support = fund;
    for (let h = 2; h <= 3; h++) {
      const hiBin = Math.round(fundI * h);
      if (hiBin >= 1 && hiBin < magnitudes.length) support += magnitudes[hiBin] * 0.5;
    }
    candidates.push({ hz: fundHz, strength: support });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.strength - a.strength);
  const chosen = candidates[0];
  // Sub-bin interpolation on the chosen fundamental.
  const idx = chosen.hz / binHz;
  const i = Math.round(idx);
  const y1 = i > 0 ? magnitudes[i - 1] : magnitudes[i];
  const y2 = magnitudes[i] ?? 0;
  const y3 = i + 1 < magnitudes.length ? magnitudes[i + 1] : y2;
  const d = y1 - 2 * y2 + y3;
  const delta = Math.abs(d) > 1e-12 ? (y1 - y3) / (2 * d) : 0;
  const hz = (i + Math.max(-0.49, Math.min(0.49, delta))) * binHz;
  if (hz < minHz || hz > maxHz) return null;
  const score = peak / (mean + 1e-12);
  return { hz, score };
}

export type FiringEstimate = {
  hz: number;
  rpm: number;
  confidence: number;
};

/** Combine autocorrelation and band-limited harmonic peak picking. */
export function estimateFiring(
  timeDomain: ArrayLike<number>,
  sampleRate: number,
  spectrum?: { magnitudes: ArrayLike<number>; fftSize: number },
  cycle: EngineCycle = "2-stroke",
): FiringEstimate | null {
  const { minHz, maxHz } = firingBand(cycle);
  const ac = firingHzFromAutocorr(timeDomain, sampleRate, minHz, maxHz);
  const fft = spectrum
    ? firingHzFromSpectrum(spectrum.magnitudes, sampleRate, spectrum.fftSize, minHz, maxHz)
    : null;
  if (!ac && !fft) return null;
  if (ac && fft) {
    const close = Math.abs(ac.hz - fft.hz) / Math.max(ac.hz, fft.hz) < 0.08;
    // Autocorr is the primary estimator. Spectrum scores (peak/mean) are on a
    // different scale, so only blend when the two agree; otherwise keep autocorr.
    const hz = close ? ac.hz * 0.7 + fft.hz * 0.3 : ac.hz;
    return { hz, rpm: hzToRpm(hz, cycle), confidence: close ? Math.max(ac.score, 0.5) : ac.score * 0.85 };
  }
  const hit = ac ?? fft!;
  return { hz: hit.hz, rpm: hzToRpm(hit.hz, cycle), confidence: hit.score };
}

export class RpmSmoother {
  private window: number[] = [];
  private smooth: number | null = null;
  private readonly windowSize: number;
  private readonly alpha: number;
  constructor(windowSize = 5, alpha = 0.32) {
    this.windowSize = windowSize;
    this.alpha = alpha;
  }

  push(rpm: number): number {
    this.window.push(rpm);
    if (this.window.length > this.windowSize) this.window.shift();
    const mid = median(this.window);
    this.smooth = ema(this.smooth, mid, this.alpha);
    return this.smooth;
  }

  reset(): void {
    this.window = [];
    this.smooth = null;
  }
}

function withLetterNote(text: string, include: boolean): string {
  return include ? `${text} ${STAMPED_LETTER_NOTE}` : text;
}

export function parseMaxRpm(
  raw: string | number | undefined | null,
  cycle: EngineCycle = "2-stroke",
): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[, ]/g, ""));
  const min = cycle === "4-stroke" ? 1000 : 3000;
  if (!Number.isFinite(n) || n < min || n > 20000) return undefined;
  return n;
}

/**
 * When a manual max RPM is set: red if over max; sweet spot is about max minus 500–1,500.
 * Below (max − 1,500) is treated as rich/bogging; between (max − 500) and max is caution.
 */
export function idleBand(spec: ModelSpec): { low: number; high: number; borderlineHigh: number } | undefined {
  if (spec.idleRpmMin != null && spec.idleRpmMax != null) {
    return { low: spec.idleRpmMin, high: spec.idleRpmMax, borderlineHigh: spec.idleRpmMax };
  }
  if (spec.idleRpm != null) {
    const i = spec.idleRpm;
    return { low: i - 200, high: i + 200, borderlineHigh: i + 300 };
  }
  return undefined;
}

export function tuneVerdict(rpm: number, mode: TuneMode, maxRpm?: number, spec?: ModelSpec, ctx?: TuneContext): TuneVerdict {
  const rounded = Math.round(rpm);
  const cycle: EngineCycle = ctx?.cycle ?? "2-stroke";

  if (cycle === "4-stroke") {
    return fourStrokeVerdict(rounded, mode, maxRpm);
  }

  if (mode === "idle") {
    const band = spec && hasOfficialIdle(spec) ? idleBand(spec) : undefined;
    if (band) {
      if (rounded < band.low) {
        return {
          tone: "yellow",
          title: "Idle Too Low (Risk of Stalling)",
          body: withLetterNote("Turn the stamped T / LA screw 1/8 turn CLOCKWISE.", true),
          isTuningInstruction: true,
        };
      }
      if (rounded <= band.high) {
        return {
          tone: "green",
          title: "Idle Locked In",
          body: "Chain/head should be completely still.",
          isTuningInstruction: false,
        };
      }
      if (rounded <= band.borderlineHigh) {
        return {
          tone: "borderline",
          title: "Idle on the high side — borderline OK",
          body: withLetterNote(
            "Still in a borderline OK range. Confirm the chain or head is completely still. If it creeps, turn the stamped T / LA screw slightly COUNTER-CLOCKWISE.",
            true,
          ),
          isTuningInstruction: true,
        };
      }
      return {
        tone: "red",
        title: "Idle Too High (Chain/Head Spinning Risk)",
        body: withLetterNote("Turn the stamped T / LA screw 1/4 turn COUNTER-CLOCKWISE.", true),
        isTuningInstruction: true,
      };
    }
    if (rounded < 2500) {
      return {
        tone: "yellow",
        title: "Idle Too Low (Risk of Stalling)",
        body: withLetterNote("Turn the stamped T / LA screw 1/8 turn CLOCKWISE.", true) + " " + MANUAL_IDLE_NOTE,
        isTuningInstruction: true,
      };
    }
    if (rounded <= 3100) {
      return {
        tone: "green",
        title: "Idle Locked In",
        body: "Chain/head should be completely still. " + MANUAL_IDLE_NOTE,
        isTuningInstruction: false,
      };
    }
    if (rounded <= 3200) {
      return {
        tone: "borderline",
        title: "Idle on the high side — borderline OK",
        body:
          withLetterNote(
            "Still in a borderline OK range. Confirm the chain or head is completely still. If it creeps, turn the stamped T / LA screw slightly COUNTER-CLOCKWISE.",
            true,
          ) +
          " " +
          MANUAL_IDLE_NOTE,
        isTuningInstruction: true,
      };
    }
    return {
      tone: "red",
      title: "Idle Too High (Chain/Head Spinning Risk)",
      body: withLetterNote("Turn the stamped T / LA screw 1/4 turn COUNTER-CLOCKWISE.", true) + " " + MANUAL_IDLE_NOTE,
      isTuningInstruction: true,
    };
  }

  const userMax = parseMaxRpm(maxRpm);
  const officialTop = officialMaxRpm(spec);
  const userOverride = userMax != null && userMax !== officialTop;

  if (!userOverride && spec && hasOfficialMax(spec) && spec.maxRpmMin != null && spec.maxRpmMax != null) {
    if (rounded < spec.maxRpmMin) {
      return {
        tone: "yellow",
        title: "Running Too Rich / Bogging",
        body: withLetterNote(
          "Check air filter & muffler spark arrestor, or turn the stamped H screw 1/8 turn CLOCKWISE.",
          true,
        ),
        isTuningInstruction: true,
      };
    }
    if (rounded <= spec.maxRpmMax) {
      return {
        tone: "green",
        title: "Sweet Spot! Healthy 4-stroking burble under no load — safe to cut.",
        body: `Within the official wide-open range listed for this model (${spec.maxRpmMin.toLocaleString()}–${spec.maxRpmMax.toLocaleString()} RPM).`,
        isTuningInstruction: false,
      };
    }
    return {
      tone: "red",
      title: "DANGER: TOO LEAN! Risk of piston seizure",
      body: withLetterNote(
        `This reading is above the official wide-open range for this model (max ${spec.maxRpmMax.toLocaleString()} RPM). Immediately turn the stamped H screw 1/8 to 1/4 turn COUNTER-CLOCKWISE.`,
        true,
      ),
      isTuningInstruction: true,
    };
  }

  const manualMax = userOverride ? userMax : (spec && spec.maxRpm != null ? spec.maxRpm : userMax);
  if (manualMax != null) {
    const sweetLow = manualMax - 1500;
    const sweetHigh = manualMax - 500;
    if (rounded > manualMax) {
      return {
        tone: "red",
        title: "DANGER: TOO LEAN! Risk of piston seizure",
        body: withLetterNote(
          `This reading is above ${spec && !userOverride && spec.maxRpm != null ? "the official max / WOT for this model" : "the max RPM you entered from the manual"} (${manualMax.toLocaleString()} RPM). Immediately turn the stamped H screw 1/8 to 1/4 turn COUNTER-CLOCKWISE.`,
          true,
        ),
        isTuningInstruction: true,
      };
    }
    if (rounded > sweetHigh) {
      return {
        tone: "yellow",
        title: "Getting lean — compare to your manual max RPM before cutting",
        body: withLetterNote(
          `Approaching ${spec && !userOverride && spec.maxRpm != null ? "the official max / WOT for this model" : "the max RPM you entered"} (${manualMax.toLocaleString()} RPM). Confirm in the manual, and if needed turn the stamped H screw slightly COUNTER-CLOCKWISE.`,
          true,
        ),
        isTuningInstruction: true,
      };
    }
    if (rounded >= sweetLow) {
      return {
        tone: "green",
        title: "Sweet Spot! Healthy 4-stroking burble under no load — safe to cut.",
        body: `Within about 500–1,500 RPM below ${spec && !userOverride && spec.maxRpm != null ? "the official max / WOT for this model" : "the max you entered from the manual"} (${manualMax.toLocaleString()} RPM).`,
        isTuningInstruction: false,
      };
    }
    return {
      tone: "yellow",
      title: "Running Too Rich / Bogging",
      body: withLetterNote(
        "Check air filter & muffler spark arrestor, or turn the stamped H screw 1/8 turn CLOCKWISE.",
        true,
      ),
      isTuningInstruction: true,
    };
  }

  if (!canUseGeneralWot(ctx)) {
    return {
      tone: "info",
      title: "RPM only — no H-screw verdict yet",
      body: NEED_MAX_BANNER,
      isTuningInstruction: false,
    };
  }

  if (rounded < 11000) {
    return {
      tone: "yellow",
      title: "Running Too Rich / Bogging",
      body: withLetterNote(
        "Check air filter & muffler spark arrestor, or turn the stamped H screw 1/8 turn CLOCKWISE.",
        true,
      ),
      isTuningInstruction: true,
    };
  }
  if (rounded <= 12800) {
    return {
      tone: "green",
      title: "Sweet Spot! Healthy 4-stroking burble under no load — safe to cut.",
      body: "This is a general chainsaw no-load range. Confirm against your manual before you cut.",
      isTuningInstruction: false,
    };
  }
  if (rounded <= 13200) {
    return {
      tone: "yellow",
      title: "Getting lean — compare to your manual max RPM before cutting",
      body: withLetterNote(
        "If your manual’s max is lower than this, turn the stamped H screw slightly COUNTER-CLOCKWISE and do not cut until you confirm.",
        true,
      ),
      isTuningInstruction: true,
    };
  }
  return {
    tone: "red",
    title: "DANGER: TOO LEAN! Risk of piston seizure",
    body: withLetterNote(
      "Immediately turn the stamped H screw 1/8 to 1/4 turn COUNTER-CLOCKWISE.",
      true,
    ),
    isTuningInstruction: true,
  };
}

function fourStrokeVerdict(rounded: number, mode: TuneMode, maxRpm?: number): TuneVerdict {
  const governed = parseMaxRpm(maxRpm, "4-stroke");
  if (mode === "full-throttle" && governed != null) {
    if (rounded > governed) {
      return {
        tone: "red",
        title: "Above the governed / max speed from your manual",
        body: `This 4-stroke reading is above the governed or max speed you entered (${governed.toLocaleString()} RPM). Let off the throttle and confirm the governor. There is no 2-stroke H-screw mixture advice in 4-stroke mode.`,
        isTuningInstruction: false,
      };
    }
    if (rounded >= governed - 200) {
      return {
        tone: "green",
        title: "At or near the governed speed from your manual",
        body: `Within about 200 RPM of the governed / max speed you entered (${governed.toLocaleString()} RPM). No H-screw advice in 4-stroke mode.`,
        isTuningInstruction: false,
      };
    }
    return {
      tone: "info",
      title: "Below the governed speed from your manual",
      body: `This reading is below the governed / max speed you entered (${governed.toLocaleString()} RPM). Confirm in the manual. No H-screw advice in 4-stroke mode.`,
      isTuningInstruction: false,
    };
  }
  return {
    tone: "info",
    title: mode === "idle" ? "4-stroke idle RPM" : "4-stroke RPM",
    body:
      "RPM is estimated as firing Hz × 120 for 4-stroke mowers, generators, and pressure washers. " +
      (governed == null
        ? "Enter your manual's governed / max speed to compare. No H-screw advice in 4-stroke mode."
        : `Idle is shown only as a reading — compare it to your manual. Governed / max entered: ${governed.toLocaleString()} RPM. No H-screw advice in 4-stroke mode.`),
    isTuningInstruction: false,
  };
}

/** Detect electronically metered carbs from user-entered name / model text only. */
export function hasElectronicCarb(tool?: { brand?: string; brandModel?: string; name?: string } | null): boolean {
  if (!tool) return false;
  const hay = [tool.brand ?? "", tool.brandModel ?? "", tool.name ?? ""].join(" ").toLowerCase();
  return /m[-\s]?tronic|mtronic|autotune|auto[-\s]?tune/.test(hay);
}

/** Build a short series of a firing tone for tests (sine + a weaker 2nd harmonic). */
export function syntheticEngineWave(
  hz: number,
  sampleRate: number,
  seconds: number,
  opts: { amplitude?: number; harmonic2?: number; noise?: number } = {},
): Float32Array {
  const amp = opts.amplitude ?? 0.7;
  const h2 = opts.harmonic2 ?? 0.25;
  const noise = opts.noise ?? 0;
  const n = Math.floor(sampleRate * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let v = amp * Math.sin(2 * Math.PI * hz * t) + h2 * Math.sin(4 * Math.PI * hz * t);
    if (noise) v += (Math.random() * 2 - 1) * noise;
    out[i] = v;
  }
  return out;
}

export function magnitudeSpectrum(samples: ArrayLike<number>, fftSize: number): Float32Array {
  const n = fftSize;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  const len = Math.min(samples.length, n);
  for (let i = 0; i < len; i++) re[i] = samples[i];
  fftRadix2(re, im);
  const bins = n / 2;
  const mag = new Float32Array(bins);
  for (let i = 0; i < bins; i++) mag[i] = Math.hypot(re[i], im[i]);
  return mag;
}

function fftRadix2(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const ang = (-2 * Math.PI) / size;
    for (let i = 0; i < n; i += size) {
      for (let k = 0; k < half; k++) {
        const cos = Math.cos(ang * k);
        const sin = Math.sin(ang * k);
        const er = re[i + half + k];
        const ei = im[i + half + k];
        const tr = cos * er - sin * ei;
        const ti = sin * er + cos * ei;
        re[i + half + k] = re[i + k] - tr;
        im[i + half + k] = im[i + k] - ti;
        re[i + k] += tr;
        im[i + k] += ti;
      }
    }
  }
}
