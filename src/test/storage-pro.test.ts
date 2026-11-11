import { beforeEach, describe, expect, it } from "vitest";
import { buildSampleFleet, loadTools, saveTools, STORAGE_KEYS } from "../lib/storage";
import { confirmPaidUnlock, isProUnlocked, proCheckoutState, setProUnlocked, tryUnlockCode } from "../lib/pro";

beforeEach(() => {
  localStorage.clear();
  setProUnlocked(false);
});

describe("storage", () => {
  it("round-trips garage tools through localStorage", () => {
    const fleet = buildSampleFleet();
    expect(fleet).toHaveLength(6);
    expect(fleet.filter((t) => t.toolType === "chainsaw")).toHaveLength(2);
    expect(fleet.filter((t) => t.toolType === "weed-eater")).toHaveLength(4);
    saveTools(fleet);
    expect(localStorage.getItem(STORAGE_KEYS.tools)).toBeTruthy();
    const loaded = loadTools();
    expect(loaded).toHaveLength(6);
    expect(loaded[0].name).toBe("Chainsaw #1");
  });
});

describe("pro unlock", () => {
  it("has live checkout, rejects an unconfigured code, and honors an I-paid unlock", () => {
    expect(proCheckoutState()).toBe("ready");
    expect(tryUnlockCode("secret").ok).toBe(false);
    expect(isProUnlocked()).toBe(false);
    confirmPaidUnlock();
    expect(isProUnlocked()).toBe(true);
  });
});
