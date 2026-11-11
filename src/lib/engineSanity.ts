import type { ModelSpec } from "../data/modelSpecs";
import { hasOfficialIdle, hasOfficialMax, officialMaxRpm } from "../data/modelSpecs";
import type { EngineCycle, TuneMode } from "./rpmMath";

/** Wildly outside official idle / WOT: more than 30% off the target. */
export const MISMATCH_PERCENT = 0.3;

export function mismatchPrompt(modelName: string): string {
  return `This doesn't sound like a ${modelName}. Did you pick the right engine?`;
}

export function officialIdleTarget(spec?: ModelSpec): number | undefined {
  if (!spec || !hasOfficialIdle(spec)) return undefined;
  if (spec.idleRpm != null) return spec.idleRpm;
  if (spec.idleRpmMin != null && spec.idleRpmMax != null) {
    return (spec.idleRpmMin + spec.idleRpmMax) / 2;
  }
  return undefined;
}

export function officialWotTarget(spec?: ModelSpec): number | undefined {
  if (!spec || !hasOfficialMax(spec)) return undefined;
  if (spec.maxRpmMin != null && spec.maxRpmMax != null) {
    return (spec.maxRpmMin + spec.maxRpmMax) / 2;
  }
  return officialMaxRpm(spec);
}

export function inOfficialRange(rpm: number, min?: number, max?: number, single?: number): boolean {
  if (min != null && max != null) return rpm >= min && rpm <= max;
  if (single != null) return true; // closeness is handled by percentOff
  return false;
}

export function percentOff(rpm: number, target: number): number {
  if (!Number.isFinite(rpm) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.abs(rpm - target) / target;
}

/** 4-stroke mowers/generators typically idle ~1,000–2,200 and run ~2,500–4,500 no-load. */
export function isFourStrokeLikeRpm(rpm: number, mode: TuneMode): boolean {
  if (mode === "idle") return rpm >= 900 && rpm <= 2200;
  return rpm >= 2400 && rpm <= 4800;
}

/** 2-stroke saws/trimmers typically idle ~2,400–3,600 and pull 7,000–14,000 no-load. */
export function isTwoStrokeLikeRpm(rpm: number, mode: TuneMode): boolean {
  if (mode === "idle") return rpm >= 2400 && rpm <= 4000;
  return rpm >= 6500 && rpm <= 16000;
}

export type SanityReason = "percent" | "cycle";

export type SanityResult = {
  mismatch: boolean;
  reason?: SanityReason;
  percentOff?: number;
  message?: string;
};

export function readingLooksWrong(
  rpm: number,
  mode: TuneMode,
  opts: {
    spec?: ModelSpec;
    cycle?: EngineCycle;
    modelName?: string;
    custom?: boolean;
  } = {},
): SanityResult {
  if (!Number.isFinite(rpm) || rpm <= 0) return { mismatch: false };
  // Custom / engine-swap tools are scored against their own baseline, not stock specs.
  if (opts.custom) return { mismatch: false };

  const cycle: EngineCycle = opts.cycle ?? opts.spec?.engineCycle ?? "2-stroke";
  const name = opts.modelName ?? opts.spec?.name ?? "this engine";

  const cycleMismatch =
    (cycle === "4-stroke" && isTwoStrokeLikeRpm(rpm, mode)) ||
    (cycle === "2-stroke" && isFourStrokeLikeRpm(rpm, mode));
  if (cycleMismatch) {
    return { mismatch: true, reason: "cycle", message: mismatchPrompt(name) };
  }

  if (mode === "idle" && hasOfficialIdle(opts.spec)) {
    const min = opts.spec!.idleRpmMin;
    const max = opts.spec!.idleRpmMax;
    if (min != null && max != null && rpm >= min && rpm <= max) return { mismatch: false };
    const target = officialIdleTarget(opts.spec);
    if (target != null && percentOff(rpm, target) > MISMATCH_PERCENT) {
      return { mismatch: true, reason: "percent", percentOff: percentOff(rpm, target), message: mismatchPrompt(name) };
    }
  }

  if (mode === "full-throttle" && hasOfficialMax(opts.spec)) {
    const min = opts.spec!.maxRpmMin;
    const max = opts.spec!.maxRpmMax;
    if (min != null && max != null && rpm >= min && rpm <= max) return { mismatch: false };
    const target = officialWotTarget(opts.spec);
    if (target != null && percentOff(rpm, target) > MISMATCH_PERCENT) {
      return { mismatch: true, reason: "percent", percentOff: percentOff(rpm, target), message: mismatchPrompt(name) };
    }
  }

  return { mismatch: false };
}
