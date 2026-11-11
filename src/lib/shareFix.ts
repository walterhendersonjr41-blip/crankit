import { APP_VERSION } from "../config/appInfo";
import { brandForTool } from "../data/brands";

/** House inbox used for opt-in shared fixes. No new account is required. */
export const SHARE_INBOX = "waltinvents@agentmail.to";

export const SHARED_FIX_FIELDS = [
  "toolType",
  "brandModel",
  "symptom",
  "fix",
  "worked",
  "appVersion",
  "date",
] as const;

export type SharedFixPayload = {
  toolType: string;
  brandModel: string;
  symptom: string;
  fix: string;
  worked: "yes" | "no";
  appVersion: string;
  date: string;
};

export type SharedFixInput = {
  toolType?: string;
  brandModel?: string;
  brand?: string;
  name?: string;
  symptom: string;
  fix: string;
  worked: "yes" | "no";
};

/** Strip emails and phone-like numbers so a typed tip cannot leak them. */
export function redactPersonal(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted]")
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[redacted]");
}

function clip(text: string, max = 400): string {
  return redactPersonal(text).trim().slice(0, max);
}

/** Brand / model only — never the garage tool's nickname. */
export function anonymousBrandModel(tool?: { brand?: string; brandModel?: string; name?: string }): string {
  if (!tool) return "";
  const brand = brandForTool(tool);
  return clip([brand?.name, tool.brandModel].filter(Boolean).join(" "));
}

export function todayStamp(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildSharedFix(input: SharedFixInput, now = new Date()): SharedFixPayload {
  return {
    toolType: clip(input.toolType ?? "", 40),
    brandModel: clip(input.brandModel ?? anonymousBrandModel(input), 80),
    symptom: clip(input.symptom, 400),
    fix: clip(input.fix, 400),
    worked: input.worked,
    appVersion: APP_VERSION,
    date: todayStamp(now),
  };
}

export function sharedFixMailto(payload: SharedFixPayload): string {
  const subject = `CrankIt shared fix: ${payload.symptom.slice(0, 60) || "driveway fix"}`;
  const body = [
    "Anonymous CrankIt driveway fix (opt-in share).",
    "",
    `toolType: ${payload.toolType}`,
    `brandModel: ${payload.brandModel}`,
    `symptom: ${payload.symptom}`,
    `fix: ${payload.fix}`,
    `worked: ${payload.worked}`,
    `appVersion: ${payload.appVersion}`,
    `date: ${payload.date}`,
  ].join("\n");
  return `mailto:${SHARE_INBOX}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function openSharedFixMail(href: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Opens a prefilled mailto with only the anonymous fields.
 * If the honeypot is filled, nothing is opened.
 */
export async function submitSharedFix(payload: SharedFixPayload, honeypot = ""): Promise<string | undefined> {
  if (honeypot.trim()) return undefined;
  const href = sharedFixMailto(payload);
  openSharedFixMail(href);
  return href;
}
