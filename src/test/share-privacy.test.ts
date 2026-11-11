import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_VERSION } from "../config/appInfo";
import { LEARNED_RULES, formatLearnedRule, matchLearnedRules, type LearnedRule } from "../data/learnedRules";
import { hasMechanicSync } from "../config/mechanicSync";
import { composeMechanicReply } from "../lib/mechanicEngine";
import { isPrivacyPath, privacyHref } from "../lib/paths";
import {
  SHARED_FIX_FIELDS,
  anonymousBrandModel,
  buildSharedFix,
  redactPersonal,
  SHARE_INBOX,
  sharedFixMailto,
  submitSharedFix,
  todayStamp,
} from "../lib/shareFix";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("anonymous shared fixes", () => {
  it("builds only the allowed anonymous fields and redacts email or phone in text", () => {
    const payload = buildSharedFix(
      {
        toolType: "chainsaw",
        brandModel: "STIHL MS 170",
        name: "Walt's driveway saw",
        symptom: "Dies when tilted — email me at test@example.com",
        fix: "Replaced the in-tank line. Call 555-123-4567",
        worked: "yes",
      },
      new Date(2026, 10, 11),
    );
    expect(Object.keys(payload).sort()).toEqual([...SHARED_FIX_FIELDS].sort());
    expect(payload).toEqual({
      toolType: "chainsaw",
      brandModel: "STIHL MS 170",
      symptom: "Dies when tilted — email me at [redacted]",
      fix: "Replaced the in-tank line. Call [redacted]",
      worked: "yes",
      appVersion: APP_VERSION,
      date: "2026-11-11",
    });
    expect(JSON.stringify(payload)).not.toMatch(/Walt/);
    expect(JSON.stringify(payload)).not.toMatch(/test@example.com/);
    expect(JSON.stringify(payload)).not.toMatch(/555-123-4567/);
    expect(anonymousBrandModel({ name: "Chainsaw #1", brand: "stihl", brandModel: "MS 170" })).toMatch(/STIHL/);
    expect(anonymousBrandModel({ name: "Chainsaw #1", brand: "stihl", brandModel: "MS 170" })).not.toMatch(/#1/);
    expect(redactPersonal("plain driveway tip")).toBe("plain driveway tip");
    expect(todayStamp(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("opens a prefilled mailto and drops a filled honeypot without opening mail", async () => {
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.href);
    });
    const payload = buildSharedFix({
      toolType: "weed-eater",
      brandModel: "ECHO SRM-225",
      symptom: "Dies when I tilt it",
      fix: "Replaced the in-tank fuel line",
      worked: "yes",
    });
    expect(await submitSharedFix(payload, "I am a bot")).toBeUndefined();
    expect(clicks).toHaveLength(0);

    const href = await submitSharedFix(payload);
    expect(href).toMatch(new RegExp(`^mailto:${SHARE_INBOX}`));
    expect(clicks).toHaveLength(1);
    const opened = decodeURIComponent(clicks[0] ?? href ?? "");
    expect(opened).toContain(SHARE_INBOX);
    expect(opened).toContain("toolType: weed-eater");
    expect(opened).toContain("brandModel: ECHO SRM-225");
    expect(opened).toContain("worked: yes");
    expect(opened).not.toMatch(/device ID/i);
    const mail = sharedFixMailto(payload);
    expect(mail.startsWith(`mailto:${SHARE_INBOX}?`)).toBe(true);
  });
});

describe("reviewed community rules hook", () => {
  it("ships empty and stays local until a curated rule is added", () => {
    expect(Array.isArray(LEARNED_RULES)).toBe(true);
    expect(LEARNED_RULES).toHaveLength(0);
    expect(hasMechanicSync()).toBe(false);
  });

  it("matches a reviewed rule and surfaces it in a mechanic reply", () => {
    const sample: LearnedRule[] = [
      {
        id: "sample-tilt",
        symptom: "Dies when I tilt it",
        fix: "Replace the in-tank fuel line and filter",
        toolType: "weed-eater",
        note: "Check your manual.",
      },
    ];
    const hits = matchLearnedRules("It dies when I tilt it sideways", { toolType: "weed-eater" }, sample);
    expect(hits[0]?.id).toBe("sample-tilt");
    expect(formatLearnedRule(hits[0]!)).toMatch(/Reviewed community fix/);
    expect(formatLearnedRule(hits[0]!)).toMatch(/Check your manual/);
  });
});

describe("shipped hooks for updates and hosting", () => {
  it("keeps the service worker cache name in sync with the app version", () => {
    const sw = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");
    expect(sw).toContain(`const CACHE = "crankit-v${APP_VERSION}"`);
    expect(sw).toContain('event.data.type === "SKIP_WAITING"');
    expect(sw).toMatch(/network first|req\.mode === "navigate"/i);
  });

  it("scopes the PWA manifest relatively so it works under /crankit/", () => {
    const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "public/manifest.webmanifest"), "utf8")) as {
      start_url: string;
      scope: string;
    };
    expect(manifest.start_url).toBe("./");
    expect(manifest.scope).toBe("./");
    const sw = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");
    expect(sw).toContain("self.registration.scope");
    const html = readFileSync(path.join(process.cwd(), "index.html"), "utf8");
    expect(html).not.toContain("data-netlify");
    expect(html).not.toContain('name="shared-fixes"');
  });
});

describe("compose with a reviewed rule injected", () => {
  it("does not invent community lines while LEARNED_RULES is empty", () => {
    const reply = composeMechanicReply("It dies when I tilt it sideways");
    expect(reply.text).not.toMatch(/Reviewed community fix/);
  });
});

describe("GitHub Pages paths", () => {
  it("treats /crankit/privacy and a privacy hash as the privacy page", () => {
    expect(isPrivacyPath("/crankit/privacy")).toBe(true);
    expect(isPrivacyPath("/privacy")).toBe(true);
    expect(isPrivacyPath("/crankit/", "#/privacy")).toBe(true);
    expect(isPrivacyPath("/crankit/")).toBe(false);
    expect(privacyHref()).toBe("/crankit/privacy");
  });
});
