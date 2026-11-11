import { configuredUnlockCode, hasStripeLink, monetization } from "../config/monetization";

export const PRO_STORAGE_KEY = "crankit.proUnlocked";

export function isProUnlocked(): boolean {
  try {
    return localStorage.getItem(PRO_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setProUnlocked(on: boolean): void {
  try {
    if (on) localStorage.setItem(PRO_STORAGE_KEY, "1");
    else localStorage.removeItem(PRO_STORAGE_KEY);
  } catch {
    // ignore quota / private mode
  }
}

export type UnlockAttempt = { ok: true } | { ok: false; reason: "empty-config" | "mismatch" | "blank" };

export function tryUnlockCode(input: string): UnlockAttempt {
  const configured = configuredUnlockCode();
  const code = input.trim();
  if (!code) return { ok: false, reason: "blank" };
  if (!configured) return { ok: false, reason: "empty-config" };
  if (code === configured) {
    setProUnlocked(true);
    return { ok: true };
  }
  return { ok: false, reason: "mismatch" };
}

export function proCheckoutState(): "ready" | "coming-soon" {
  return hasStripeLink() ? "ready" : "coming-soon";
}

export function proPriceLabel(): string {
  return monetization.proPriceLabel;
}

export function stripePaymentLink(): string {
  return monetization.stripePaymentLink.trim();
}

/** Honor-system unlock after the buyer says they paid. No receipt is verified. */
export function confirmPaidUnlock(): void {
  setProUnlocked(true);
}
