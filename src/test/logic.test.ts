import { describe, expect, it } from "vitest";
import { STAMPED_LETTER_NOTE } from "../data/carbNotes";
import { LETTER_CHECK_NOTE, TREES, allStepCount, treeById } from "../data/diagnostics";
import { amazonSearchUrl, hasAffiliateTag, hasLocalShopSponsor, hasStripeLink, partUrl, monetization } from "../config/monetization";
import { RATIOS, calculateMix, daysRemaining, expirationDate, formatQty } from "../lib/fuel";
import { evaluateShop } from "../lib/shopMeter";
import { configuredUnlockCode } from "../config/monetization";

describe("diagnostic trees", () => {
  it("ships all 6 trees with every required step field", () => {
    expect(TREES).toHaveLength(6);
    expect(allStepCount()).toBeGreaterThanOrEqual(23);
    for (const tree of TREES) {
      expect(tree.id).toBeTruthy();
      expect(tree.title).toBeTruthy();
      expect(tree.steps.length).toBeGreaterThan(0);
      for (const step of tree.steps) {
        expect(step.title).toBeTruthy();
        expect(step.body.length).toBeGreaterThan(20);
        expect(step.costLabel).toMatch(/\$/);
        expect(step.timeLabel).toMatch(/min/);
        expect(["diy", "part", "shop"]).toContain(step.badge);
      }
    }
  });

  it("branches Tree 4 (won't start) after the wet test and the scoring check", () => {
    const tree = treeById("wont-start");
    expect(tree).toBeTruthy();
    const wet = tree!.steps[0];
    expect(wet.branch?.options.map((o) => o.id).sort()).toEqual(["fired", "zero-pop"]);
    const fired = wet.branch!.options.find((o) => o.id === "fired")!;
    expect(fired.action.type).toBe("end-diy");
    const zero = wet.branch!.options.find((o) => o.id === "zero-pop")!;
    expect(zero.action.type).toBe("continue");
    const score = tree!.steps[2];
    expect(score.branch?.options.map((o) => o.id).sort()).toEqual(["healthy", "not-checked", "scored"]);
  });

  it("warns about stamped screw letters, limiter caps, fire, and hot mufflers", () => {
    const text = JSON.stringify(TREES);
    expect(LETTER_CHECK_NOTE).toBe(STAMPED_LETTER_NOTE);
    expect(text).toContain(STAMPED_LETTER_NOTE);
    expect(text).toMatch(/limiter cap/i);
    expect(text).toMatch(/fire extinguisher/i);
    expect(text).toMatch(/Disconnect the spark-plug wire/i);
    expect(text).toMatch(/propane torch/i);
    expect(text).toMatch(/extinguisher or hose/i);
  });
});

describe("fuel calculator", () => {
  it("matches the published oz-per-gallon figures", () => {
    expect(RATIOS[0].ozPerGal).toBeCloseTo(2.56, 2);
    expect(RATIOS[1].ozPerGal).toBeCloseTo(3.2, 5);
    expect(RATIOS[2].ozPerGal).toBeCloseTo(4.0, 5);
    const one = calculateMix(1, "50:1");
    expect(one.oilOz).toBeCloseTo(2.56, 2);
    expect(one.oilMl).toBeCloseTo(2.56 * 29.5735295625, 2);
    expect(one.oilTbsp).toBeCloseTo(5.12, 2);
    const big = calculateMix(2.5, "40:1");
    expect(big.oilOz).toBeCloseTo(8, 5);
    expect(formatQty(8)).toBe("8");
  });

  it("uses 30-day and 90-day freshness windows", () => {
    const mixed = "2026-11-01T00:00:00.000Z";
    const now = new Date("2026-11-11T00:00:00.000Z");
    expect(daysRemaining(mixed, false, now)).toBe(20);
    expect(daysRemaining(mixed, true, now)).toBe(80);
    expect(expirationDate(mixed, false).toISOString().startsWith("2026-12-01")).toBe(true);
  });
});

describe("shop meter", () => {
  it("stays incomplete until all four answers are in", () => {
    expect(evaluateShop({ compression: "yes", fired: "", unscratched: "", uncracked: "" }).kind).toBe("incomplete");
  });

  it("returns green when the core is healthy", () => {
    const r = evaluateShop({ compression: "yes", fired: "yes", unscratched: "yes", uncracked: "yes" });
    expect(r.kind).toBe("green");
    expect(r.title).toMatch(/DO NOT TAKE THIS TO A SHOP/i);
  });

  it("returns red on dead compression, scoring, or a cracked case", () => {
    expect(evaluateShop({ compression: "no", fired: "yes", unscratched: "yes", uncracked: "yes" }).kind).toBe("red");
    expect(evaluateShop({ compression: "yes", fired: "yes", unscratched: "no", uncracked: "yes" }).kind).toBe("red");
    expect(evaluateShop({ compression: "yes", fired: "yes", unscratched: "yes", uncracked: "no" }).kind).toBe("red");
  });
});

describe("monetization switches", () => {
  it("ships with a live Stripe Payment Link and empty affiliate, unlock-code, and shop-sponsor switches", () => {
    expect(monetization.amazonAssociateTag).toBe("");
    expect(monetization.stripePaymentLink).toBe("https://buy.stripe.com/14A6oH1tibkAcKP5bE1Fe00");
    expect(configuredUnlockCode()).toBe("");
    expect(hasAffiliateTag()).toBe(false);
    expect(hasStripeLink()).toBe(true);
    expect(hasLocalShopSponsor()).toBe(false);
  });

  it("builds plain Amazon search URLs when the tag is empty, and appends a tag when set", () => {
    const plain = amazonSearchUrl("tygon fuel line");
    expect(plain).toContain("https://www.amazon.com/s");
    expect(plain).toContain("tygon");
    expect(plain).not.toContain("tag=");
    const tagged = amazonSearchUrl("tygon fuel line", "exampletag-20");
    expect(tagged).toContain("tag=exampletag-20");
    expect(partUrl("carb-adjustment-tool")).toContain("amazon.com");
  });
});
