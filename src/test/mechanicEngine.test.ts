import { describe, expect, it } from "vitest";
import { hasRemoteMechanic, mechanicAi } from "../config/mechanicAi";
import { STAMPED_LETTER_NOTE } from "../data/carbNotes";
import { LETTER_CHECK_NOTE, TREES } from "../data/diagnostics";
import {
  QUICK_CHIPS,
  buildGreeting,
  detectIntent,
  replyTo,
  reportsCoreFailure,
  toolNames,
} from "../lib/mechanicEngine";

describe("mechanic intent engine", () => {
  it("maps every quick-tap chip to the intended rule", () => {
    expect(detectIntent(QUICK_CHIPS[0])).toBe("bogs-choke");
    expect(detectIntent(QUICK_CHIPS[1])).toBe("dies-tilted");
    expect(detectIntent(QUICK_CHIPS[2])).toBe("wrong-oil-gas");
    expect(detectIntent(QUICK_CHIPS[3])).toBe("carb-screws");
    expect(detectIntent(QUICK_CHIPS[4])).toBe("shop-threshold");
  });

  it("recognizes wrong oil, old gas, and starting fluid in plain English", () => {
    for (const q of ["I put 10W-30 in my trimmer", "old gas in the saw", "someone used starting fluid"]) {
      expect(detectIntent(q)).toBe("wrong-oil-gas");
    }
    const r = replyTo("I used 20W-20 motor oil");
    expect(r.intent).toBe("wrong-oil-gas");
    expect(r.text).toMatch(/4-stroke/i);
    expect(r.text).toMatch(/carbon/i);
    expect(r.text).toMatch(/lubricat/i);
    expect(r.text).toMatch(/drain/i);
    expect(r.text).toMatch(/flush/i);
    expect(r.text).toMatch(/ethanol-free 91 or 93/i);
    expect(r.text).toMatch(/50:1/);
    expect(r.text).toMatch(/JASO FD/);
    expect(r.text).toMatch(/spark-arrestor/i);
    expect(r.text).toMatch(/Fire safety/i);
    expect(r.text).toMatch(/extinguisher/i);
    expect(r.links.some((l) => l.tab === "fuel")).toBe(true);
  });

  it("treats dies-when-tilted as a $3–$5 fuel-line fix, not a shop visit", () => {
    const r = replyTo("It dies when I tilt it sideways");
    expect(r.intent).toBe("dies-tilted");
    expect(r.text).toMatch(/fuel line/i);
    expect(r.text).toMatch(/filter/i);
    expect(r.text).toMatch(/\$3/);
    expect(r.text).toMatch(/not a shop|never a shop/i);
    expect(r.text).not.toMatch(/take it to a shop/i);
  });

  it("explains L/H/T, insists on stamped letters, and warns about limiter caps", () => {
    const r = replyTo("Which carb screw do I turn?");
    expect(r.intent).toBe("carb-screws");
    expect(r.text).toMatch(/\bL\b/);
    expect(r.text).toMatch(/\bH\b/);
    expect(r.text).toMatch(/T or LA|T \(or LA\)|T\/LA/);
    expect(r.text).toContain(STAMPED_LETTER_NOTE);
    expect(r.text).toMatch(/limiter cap/i);
    expect(r.text).toMatch(/1\.5-turn/);
    expect(r.text).toMatch(/varies by model|check the manual/i);
    expect(r.links.some((l) => l.tab === "carb")).toBe(true);
  });

  it("uses one shared stamped-letter note in the bot, Diagnose L/H/T steps, and the re-exported UI constant", () => {
    expect(LETTER_CHECK_NOTE).toBe(STAMPED_LETTER_NOTE);
    expect(STAMPED_LETTER_NOTE).toMatch(/Always verify the stamped L, H and T\/LA letters on the carb body/);
    expect(STAMPED_LETTER_NOTE).toMatch(/Zama, Walbro, and Tillotson/);
    expect(STAMPED_LETTER_NOTE).toMatch(/differ by mounting/);
    expect(replyTo("Which carb screw do I turn?").text).toContain(STAMPED_LETTER_NOTE);
    expect(replyTo("Runs on choke, dies off choke").text).toContain(STAMPED_LETTER_NOTE);
    const lht = TREES.flatMap((tree) => tree.steps).filter((step) => step.letterCheck);
    expect(lht.map((s) => s.id).sort()).toEqual(["t2-s1", "t3-s2", "t6-s1", "t6-s2"]);
    for (const step of lht) {
      expect(step.body).toContain(STAMPED_LETTER_NOTE);
    }
  });

  it("only advises shop or replacement when compression is gone or the cylinder is scored", () => {
    expect(reportsCoreFailure("Is my engine blown?")).toBe(false);
    const check = replyTo("Is my engine blown?");
    expect(check.intent).toBe("shop-threshold");
    expect(check.text).toMatch(/Don't call it blown yet/i);
    expect(check.text).toMatch(/\$0–\$12|cheap checks/i);
    expect(check.text).not.toMatch(/stop buying carb kits/i);

    const scored = replyTo("There is zero compression and vertical scratches on the piston");
    expect(reportsCoreFailure("There is zero compression and vertical scratches on the piston")).toBe(true);
    expect(scored.intent).toBe("shop-threshold");
    expect(scored.text).toMatch(/stop buying carb kits/i);
    expect(scored.text).toMatch(/rebuild|spare parts|replace/i);
    expect(scored.links.some((l) => l.tab === "shop")).toBe(true);
  });

  it("walks no-shop-first $0–$12 checks for a no-start", () => {
    const r = replyTo("It won't start at all");
    expect(r.intent).toBe("wont-start");
    expect(r.text).toMatch(/kill switch/i);
    expect(r.text).toMatch(/boot/i);
    expect(r.text).toMatch(/spark-arrestor|ethanol|diaphragm|wet test/i);
    expect(r.text).toMatch(/do not go to a shop yet/i);
    expect(r.text).toMatch(/1\/2-teaspoon|1\/2 teaspoon/i);
    expect(r.text).toMatch(/extinguisher/i);
  });

  it("has a sensible fallback that still follows no-shop-first", () => {
    const r = replyTo("hmm what about this weird noise");
    expect(r.intent).toBe("fallback");
    expect(r.text).toMatch(/\$0–\$12/);
    expect(r.text).toMatch(/kill switch/i);
    expect(r.text).toMatch(/diaphragm/i);
    expect(r.links.some((l) => l.tab === "diagnose")).toBe(true);
  });

  it("greets the user by naming saved garage tools", () => {
    const empty = buildGreeting([]);
    expect(empty.text).toMatch(/Add your saws/i);
    const one = buildGreeting([{ name: "Chainsaw #1", toolType: "chainsaw" }]);
    expect(one.text).toContain("Chainsaw #1");
    expect(toolNames([{ name: "Chainsaw #1" }, { name: "Weed Eater #2" }])).toBe("Chainsaw #1 and Weed Eater #2");
    const many = buildGreeting([
      { name: "Chainsaw #1", toolType: "chainsaw" },
      { name: "Chainsaw #2", toolType: "chainsaw" },
      { name: "Weed Eater #1", toolType: "weed-eater" },
    ]);
    expect(many.text).toMatch(/Chainsaw #1, Chainsaw #2, and Weed Eater #1/);
  });

  it("keeps the remote LLM hook off", () => {
    expect(mechanicAi.endpoint).toBe("");
    expect(mechanicAi.apiKey).toBe("");
    expect(hasRemoteMechanic()).toBe(false);
  });
});
