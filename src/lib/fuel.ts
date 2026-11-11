export const RATIOS = [
  { id: "50:1", label: "50:1", ozPerGal: 128 / 50, hint: "2.6 oz/gal" },
  { id: "40:1", label: "40:1", ozPerGal: 128 / 40, hint: "3.2 oz/gal" },
  { id: "32:1", label: "32:1", ozPerGal: 128 / 32, hint: "4.0 oz/gal" },
] as const;

export type RatioId = (typeof RATIOS)[number]["id"];

export const CAN_PRESETS = [0.5, 1, 2, 2.5, 5] as const;

const ML_PER_FLOZ = 29.5735295625;
const TBSP_PER_FLOZ = 2;

export type MixResult = {
  gallons: number;
  ratio: RatioId;
  ozPerGal: number;
  oilOz: number;
  oilMl: number;
  oilTbsp: number;
};

export function ratioById(id: string): (typeof RATIOS)[number] {
  return RATIOS.find((r) => r.id === id) ?? RATIOS[0];
}

export function calculateMix(gallons: number, ratioId: RatioId): MixResult {
  const ratio = ratioById(ratioId);
  const oilOz = gallons * ratio.ozPerGal;
  return {
    gallons,
    ratio: ratio.id,
    ozPerGal: ratio.ozPerGal,
    oilOz,
    oilMl: oilOz * ML_PER_FLOZ,
    oilTbsp: oilOz * TBSP_PER_FLOZ,
  };
}

export function formatQty(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Number(n.toFixed(digits));
  return String(rounded);
}

export const SHELF_DAYS_UNSTABILIZED = 30;
export const SHELF_DAYS_STABILIZED = 90;

export function expirationDate(mixedOnIso: string, stabilized: boolean): Date {
  const start = new Date(mixedOnIso);
  const days = stabilized ? SHELF_DAYS_STABILIZED : SHELF_DAYS_UNSTABILIZED;
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
}

export function daysRemaining(mixedOnIso: string, stabilized: boolean, now = new Date()): number {
  const end = expirationDate(mixedOnIso, stabilized);
  const ms = end.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export const FUEL_WARNING =
  "Use 89–93 octane ethanol-free pure gas + JASO FD / ISO-L-EGD air-cooled 2-cycle oil ONLY. Never use 4-stroke motor oil (20W-50, 10W-30, or 20W-20) or starting fluid.";
