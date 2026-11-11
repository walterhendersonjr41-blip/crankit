import { brandForTool, detectBrand, formatBrandNote } from "../data/brands";
import { formatLearnedRule, matchLearnedRules } from "../data/learnedRules";
import { LIMITER_NOTE, STAMPED_LETTER_NOTE } from "../data/carbNotes";
import { matchTips, normalizeSymptomKey, provenLine, rankedFixes } from "./mechanicLearning";
import type { GarageTool } from "./storage";

export type MechanicIntent =
  | "greeting"
  | "wrong-oil-gas"
  | "dies-tilted"
  | "carb-screws"
  | "rpm-tuner"
  | "shop-threshold"
  | "bogs-choke"
  | "wont-start"
  | "fallback";

export type MechanicTab = "diagnose" | "carb" | "fuel" | "garage" | "shop";

export type MechanicLink = {
  tab: MechanicTab;
  label: string;
  focus?: "tuner";
};

export type MechanicReply = {
  intent: MechanicIntent;
  text: string;
  links: MechanicLink[];
};

export const QUICK_CHIPS = [
  "Runs on choke, dies off choke",
  "Dies when I tilt it sideways",
  "Put wrong oil / old gas in it",
  "Which carb screw do I turn?",
  "Is my engine blown?",
  "Listen to my engine",
] as const;

const FIRE_DRAIN =
  "Fire safety: drain and mix fuel outdoors, away from sparks, cigarettes, and flames. Keep a fire extinguisher handy and wipe spills.";

const TORCH_SCREEN =
  "If you burn carbon off the spark-arrestor screen, let the muffler cool first, do it outdoors away from fuel, hold the screen with pliers, and keep a hose or extinguisher nearby. Let the screen cool completely before it goes back on.";

const PLUG_WIRE =
  "Disconnect the spark-plug wire (and park it where it cannot spring back onto the plug) before you work around a chain, clutch, or trimmer head. Let hot parts cool.";

function has(text: string, ...needles: string[]): boolean {
  return needles.some((n) => text.includes(n));
}

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function detectIntent(input: string): MechanicIntent {
  const t = normalize(input);
  if (!t) return "fallback";

  // Exact (and near-exact) chip matches first.
  if (
    t === normalize(QUICK_CHIPS[5]) ||
    has(
      t,
      "listen to my engine",
      "listen to the engine",
      "listen to engine",
      "acoustic rpm",
      "sound tuner",
      "rpm tuner",
      "live rpm",
      "check my rpm",
      "engine rpm",
      "tachometer",
    )
  ) {
    return "rpm-tuner";
  }
  if (t === normalize(QUICK_CHIPS[0]) || (has(t, "choke") && has(t, "dies", "die", "bogs", "stall"))) {
    if (!has(t, "tilt", "sideways", "on its side")) return "bogs-choke";
  }
  if (t === normalize(QUICK_CHIPS[1]) || has(t, "tilt", "tilted", "sideways", "on its side", "on the side", "tip it", "lean it")) {
    return "dies-tilted";
  }
  if (
    t === normalize(QUICK_CHIPS[2]) ||
    has(
      t,
      "wrong oil",
      "4-stroke",
      "4 stroke",
      "four stroke",
      "20w-20",
      "20w20",
      "20w-50",
      "10w-30",
      "10w30",
      "motor oil",
      "starting fluid",
      "ether",
      "old gas",
      "stale gas",
      "stale mix",
      "bad gas",
      "old mix",
      "ethanol",
      "varnish",
    )
  ) {
    return "wrong-oil-gas";
  }
  if (
    t === normalize(QUICK_CHIPS[3]) ||
    has(t, "which screw", "which carb", "carb screw", "l screw", "h screw", "t screw", "t/la", "idle screw", "mixture screw", "limiter")
  ) {
    return "carb-screws";
  }
  if (
    t === normalize(QUICK_CHIPS[4]) ||
    has(
      t,
      "engine blown",
      "blown engine",
      "is it blown",
      "is my engine",
      "scored",
      "scoring",
      "zero compression",
      "no compression",
      "dead compression",
      "vertical scratch",
      "vertical gouge",
      "piston scratch",
      "take it to a shop",
      "is it toast",
      "rebuild",
    )
  ) {
    return "shop-threshold";
  }
  if (has(t, "choke") || has(t, "bogs", "bogging") || (has(t, "dies", "die", "stall") && has(t, "trigger", "throttle", "squeeze"))) {
    return "bogs-choke";
  }
  if (
    has(t, "won't start", "wont start", "will not start", "won't crank", "wont crank", "no start", "no spark", "flooded", "intermittent", "one day")
  ) {
    return "wont-start";
  }
  return "fallback";
}

export function reportsCoreFailure(input: string): boolean {
  const t = normalize(input);
  return has(
    t,
    "zero compression",
    "no compression",
    "dead compression",
    "no spring",
    "spins freely",
    "no resistance",
    "scored",
    "scoring",
    "vertical scratch",
    "vertical scratches",
    "vertical gouge",
    "piston scratch",
    "gouges on the piston",
  );
}

export function toolNames(tools: Pick<GarageTool, "name">[]): string {
  const names = tools.map((t) => t.name.trim()).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function buildGreeting(tools: Pick<GarageTool, "name" | "toolType">[]): MechanicReply {
  const named = toolNames(tools);
  const text = named
    ? `Hey — I'm your driveway mechanic. I see ${named} in My Garage. Ask me what's going on in plain English, or tap a question below. I'll walk the cheap $0–$12 checks first and only talk shop if the engine core is actually hurt.`
    : "Hey — I'm your driveway mechanic. Add your saws and trimmers in My Garage and I'll call them by name. What's going on? I'll walk the cheap $0–$12 checks first — I won't send you to a shop unless the engine core is truly hurt.";
  return {
    intent: "greeting",
    text,
    links: named ? [] : [{ tab: "garage", label: "Open My Garage" }],
  };
}

const REPLIES: Record<Exclude<MechanicIntent, "greeting">, (input: string) => MechanicReply> = {
  "wrong-oil-gas": () => ({
    intent: "wrong-oil-gas",
    text:
      "Wrong oil or stale gas is a driveway problem, not a shop visit.\n\n" +
      "4-stroke motor oil (20W-20, 10W-30, 10W-40, and the like) does not lubricate a 2-stroke the way JASO FD / ISO-L-EGD oil does — it can leave heavy carbon and starve the crank and piston of the oil that should be mixed in the gas. Old ethanol gas turns to varnish and water, and starting fluid (ether) is a dry, harsh solvent that can scuff a cylinder. Neither belongs in these tools.\n\n" +
      "Do this: drain the tank completely into a clearly labeled can. Pull the fuel lines and in-tank filter if they are stiff or cracked, then flush the tank with a little fresh ethanol-free 91 or 93 octane mixed 50:1 with air-cooled JASO FD 2-cycle oil (use the Fuel Mix tab to measure). Refill with that mix only — never 4-stroke oil, never starting fluid. If it has been running the bad mix, pull the muffler spark-arrestor screen and clean the carbon off; you can burn baked-on soot off carefully with a lighter or small torch, then brush it.\n\n" +
      `${FIRE_DRAIN} ${TORCH_SCREEN}\n\n` +
      "If it still bogs after a fresh mix and a clean screen, check the $6 carb diaphragm and the L/H screws next — still no shop.",
    links: [
      { tab: "fuel", label: "Open Fuel Mix" },
      { tab: "diagnose", label: "Open Diagnose" },
    ],
  }),
  "dies-tilted": () => ({
    intent: "dies-tilted",
    text:
      "If it runs until you tilt or lay it sideways, then dies, this is almost never a shop job. The in-tank fuel line has usually hardened or cracked, or the weighted felt filter has pulled out of the fuel so the carb is sucking air.\n\n" +
      "Fish the line out of the tank with a bent wire hook (outdoors, away from sparks). If the line is stiff, split at the grommet, or the filter isn't staying in the fuel, replace the Tygon (or equivalent) line and the $3 in-tank filter — a $3–$5 driveway fix.\n\n" +
      `${FIRE_DRAIN}`,
    links: [{ tab: "diagnose", label: "Open Diagnose (primer / fuel-line tree)" }],
  }),
  "rpm-tuner": () => ({
    intent: "rpm-tuner",
    text:
      "Use the Acoustic RPM & Carb Sound Tuner on the Carb & Tune tab. It listens on this device only — audio is never recorded or uploaded.\n\n" +
      "Hold the phone near the muffler, pick At Idle or Full Throttle Test, and read the verdict. If the garage tool’s model is in the official-spec list, those manual RPM figures are used automatically. Otherwise we use general ranges, or a max RPM you type from your manual.\n\n" +
      STAMPED_LETTER_NOTE +
      " " +
      LIMITER_NOTE,
    links: [{ tab: "carb", label: "Open the sound tuner", focus: "tuner" }],
  }),
  "carb-screws": () => ({
    intent: "carb-screws",
    text:
      "Three screws, three jobs:\n\n" +
      "• L (low speed) — idle quality and the snap when you squeeze the trigger. If it starts on choke and dies when you give it gas, richen L a little (counter-clockwise, 1/8 to 1/4 turn).\n" +
      "• H (high speed) — full-throttle cutting power. If it bogs in thick wood or tall grass, richen H 1/8 turn counter-clockwise. A too-lean H can score the piston, so sneak up on it.\n" +
      "• T or LA — idle speed. If the chain or string keeps spinning at idle, turn T/LA counter-clockwise 1/4 turn at a time until it stops, without stalling.\n\n" +
      STAMPED_LETTER_NOTE +
      " " +
      LIMITER_NOTE +
      "\n\nKeep hands clear of the chain or head while you set idle. " +
      PLUG_WIRE,
    links: [
      { tab: "carb", label: "Open Carb & Tune" },
      { tab: "diagnose", label: "Open Diagnose" },
    ],
  }),
  "shop-threshold": (input) => {
    if (reportsCoreFailure(input)) {
      return {
        intent: "shop-threshold",
        text:
          "If the pull cord has almost no springy resistance (zero compression), or you can see deep vertical scratches on the piston or cylinder through the exhaust port, stop buying carb kits. That is internal damage. A shop rebuild often costs more than a replacement tool — keep it for spare parts or replace it.\n\n" +
          "Let the muffler cool, disconnect the plug wire, then you can pull the muffler (usually 2 bolts) to look through the exhaust port. " +
          PLUG_WIRE,
        links: [{ tab: "shop", label: "Open Shop Meter" }],
      };
    }
    return {
      intent: "shop-threshold",
      text:
        "Don't call it blown yet — and don't take it to a shop just because it won't run. A dead carb, stale gas, a fouled plug wire, or a clogged spark-arrestor screen can feel like a dead engine.\n\n" +
        "Work the cheap checks first ($0–$12): kill switch and flooding, plug wire and boot clip, spark-arrestor screen, fresh ethanol-free mix, a $6 diaphragm, then L/H tuning.\n\n" +
        "Only treat the core as hurt if (1) the pull cord has almost no springy compression, or (2) you can see deep vertical scratches on the piston or cylinder through the exhaust port after the muffler is off and cool. Use the Shop Meter to walk those four questions.\n\n" +
        "Let the muffler cool and disconnect the plug wire before you look through the exhaust port. " +
        PLUG_WIRE,
      links: [
        { tab: "shop", label: "Open Shop Meter" },
        { tab: "diagnose", label: "Open Diagnose" },
      ],
    };
  },
  "bogs-choke": () => ({
    intent: "bogs-choke",
    text:
      "Starts on choke, then dies or bogs when you squeeze the trigger — stay in the driveway. In order, cheapest first:\n\n" +
      "1. Confirm the L screw by the stamped letter and richen it 1/8 to 1/4 turn counter-clockwise (limiter caps may only allow a fraction of a turn — don't force them).\n" +
      "2. Pull the muffler spark-arrestor screen and clean the carbon. " +
      TORCH_SCREEN +
      "\n" +
      "3. Check the in-tank felt filter and the fuel lines for cracks that suck air.\n" +
      "4. If the black carb diaphragm is stiff like paper, replace the $6 kit.\n\n" +
      "None of that is a shop visit. " +
      STAMPED_LETTER_NOTE +
      " " +
      LIMITER_NOTE,
    links: [
      { tab: "diagnose", label: "Open Diagnose (bogs on acceleration)" },
      { tab: "carb", label: "Open Carb & Tune" },
    ],
  }),
  "wont-start": () => ({
    intent: "wont-start",
    text:
      "A no-start is usually a $0–$12 driveway fix. Work them in this order and do not go to a shop yet:\n\n" +
      "1. Kill switch on, and clear a flooded cylinder if you've been pulling on full choke (plug out, switch off, pull about 8 times, dry the plug, choke off).\n" +
      "2. Pull the plug boot — check the metal spring clip and any cracked wire rubbing on metal. Re-seat until it clicks.\n" +
      "3. Dump stale ethanol gas and run fresh ethanol-free 91/93 mixed 50:1 with JASO FD oil.\n" +
      "4. Try the 1/2-teaspoon wet test in the carb throat. If it fires for a couple of seconds, spark and compression are good — chase fuel delivery (diaphragm, lines, filter), not a shop rebuild. " +
      FIRE_DRAIN +
      " Use only 1/2 teaspoon, outdoors, extinguisher handy, wipe spills.\n" +
      "5. If it never pops, check for a blue spark, then feel for springy compression and look for vertical scoring through a cool exhaust port.\n\n" +
      "Shop or replace only if compression is gone or the piston/cylinder is scored.",
    links: [
      { tab: "diagnose", label: "Open Diagnose" },
      { tab: "shop", label: "Open Shop Meter" },
    ],
  }),
  fallback: () => ({
    intent: "fallback",
    text:
      "I can help with no-starts, bogs, wrong oil or stale gas, dies-when-tilted, carb screws, and whether the engine core is actually hurt.\n\n" +
      "Whatever the symptom, we start with the cheap $0–$12 driveway checks — kill switch and flooding, plug wire and boot clip, clogged spark-arrestor screen, stale ethanol gas, a $6 carb diaphragm, and L/H tuning. I only point to a shop or a replacement if you have zero compression or visible vertical scoring through the exhaust port.\n\n" +
      "Tell me what it's doing, or tap a question below. The Diagnose tab will walk the same checks step by step.",
    links: [{ tab: "diagnose", label: "Open Diagnose" }],
  }),
};

export function replyTo(input: string): MechanicReply {
  const intent = detectIntent(input);
  if (intent === "greeting") return REPLIES.fallback(input);
  return REPLIES[intent](input);
}


export type MechanicContext = {
  tools?: Pick<GarageTool, "id" | "name" | "brandModel" | "brand" | "toolType">[];
  toolId?: string;
};

export function composeMechanicReply(input: string, ctx: MechanicContext = {}): MechanicReply {
  const base = replyTo(input);
  const tools = ctx.tools ?? [];
  const selected = tools.find((t) => t.id === ctx.toolId) ?? (tools.length === 1 ? tools[0] : undefined);
  const brand =
    brandForTool(selected) ??
    detectBrand(input) ??
    (tools.length ? uniqueBrand(tools) : undefined);

  const ranked = collectRankedFixes(`${base.intent} ${input}`, base.intent, selected?.id);
  const proven = ranked.filter((r) => r.helpful > r.unhelpful).slice(0, 3);
  const tips = matchTips(input);

  const parts: string[] = [];
  if (proven.length) {
    parts.push(proven.map((f) => provenLine(f, selected?.name)).join("\n"));
  }
  if (tips.length) {
    parts.push(
      tips
        .slice(0, 3)
        .map((tip) => `You taught the mechanic: when “${tip.symptom}”, try this — ${tip.fix}.`)
        .join("\n"),
    );
  }
  const rules = matchLearnedRules(input, { toolType: selected?.toolType, brand: brand?.id });
  if (rules.length) {
    parts.push(rules.slice(0, 3).map((rule) => formatLearnedRule(rule)).join("\n"));
  }
  parts.push(base.text);
  if (brand) parts.push(formatBrandNote(brand));

  return { ...base, text: parts.join("\n\n") };
}

function uniqueBrand(tools: Pick<GarageTool, "brand" | "brandModel" | "name">[]) {
  const found = tools.map((t) => brandForTool(t)).filter((b): b is NonNullable<typeof b> => Boolean(b));
  if (found.length === 0) return undefined;
  const id = found[0].id;
  return found.every((b) => b.id === id) ? found[0] : undefined;
}


const INTENT_SYMPTOMS: Record<MechanicIntent, string[]> = {
  "wrong-oil-gas": ["intermittent-start", "wrong oil", "old gas", "fuel mix", "4-stroke oil"],
  "dies-tilted": ["primer-bulb", "dies when tilted", "fuel line", "in-tank"],
  "carb-screws": ["carb", "idle", "spins-at-idle", "bogs-on-accel", "L H T"],
  "rpm-tuner": ["rpm", "idle", "tach", "tune"],
  "bogs-choke": ["bogs-on-accel", "bogs-under-load", "bogs", "choke"],
  "wont-start": ["wont-start", "won't start", "no start", "spark"],
  "shop-threshold": ["shop meter", "compression", "scoring"],
  greeting: [],
  fallback: [],
};

function collectRankedFixes(input: string, intent: MechanicIntent, toolId?: string) {
  const keys = new Set<string>([
    normalizeSymptomKey(input),
    normalizeSymptomKey(intent),
    ...INTENT_SYMPTOMS[intent],
  ]);
  const map = new Map<string, ReturnType<typeof rankedFixes>[number]>();
  for (const key of keys) {
    if (!key) continue;
    for (const row of rankedFixes({ symptomKey: key, toolId })) {
      const id = `${row.toolId ?? ""}::${row.fixKey}`;
      const prev = map.get(id);
      if (!prev || row.score > prev.score) map.set(id, row);
    }
  }
  return [...map.values()].sort((a, b) => b.score - a.score || b.helpful - a.helpful);
}
