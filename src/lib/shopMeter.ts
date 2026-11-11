export type YesNo = "yes" | "no";
export type YesNoUnchecked = "yes" | "no" | "unchecked";

export type ShopAnswers = {
  compression: YesNo | "";
  fired: YesNo | "";
  unscratched: YesNoUnchecked | "";
  uncracked: YesNo | "";
};

export type ShopResultKind = "green" | "red" | "amber" | "incomplete";

export type ShopResult = {
  kind: ShopResultKind;
  title: string;
  body: string;
};

export const SHOP_QUESTIONS: {
  key: keyof ShopAnswers;
  prompt: string;
  options: { value: string; label: string }[];
  safety?: string;
}[] = [
  {
    key: "compression",
    prompt: "Does the pull cord have strong springy resistance (compression)?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    key: "fired" as const,
    prompt: "Did it fire for 2 seconds when you put 1/2 tsp of 50:1 mix in the carb?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    safety:
      "Fire safety: do the wet test outdoors only, away from sparks and flames, with an extinguisher handy. Use just 1/2 teaspoon, and wipe spills before you pull the cord.",
  },
  {
    key: "unscratched" as const,
    prompt: "Are the piston and cylinder walls free of deep vertical scratches?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No — I see scoring" },
      { value: "unchecked", label: "Not checked" },
    ],
    safety:
      "Let the muffler cool and disconnect the plug wire before you remove it to look through the exhaust port.",
  },
  {
    key: "uncracked" as const,
    prompt: "Is the metal frame / crankcase uncracked?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No — it is cracked" },
    ],
  },
];

export function evaluateShop(answers: ShopAnswers): ShopResult {
  const { compression, fired, unscratched, uncracked } = answers;
  if (!compression || !fired || !unscratched || !uncracked) {
    return {
      kind: "incomplete",
      title: "Answer all four questions",
      body: "The meter needs every answer before it can tell you shop vs. driveway.",
    };
  }

  const coreDead = compression === "no" || unscratched === "no" || uncracked === "no";
  if (coreDead) {
    const bits: string[] = [];
    if (compression === "no") bits.push("compression is gone");
    if (unscratched === "no") bits.push("the piston/cylinder is scored");
    if (uncracked === "no") bits.push("the crankcase or frame is cracked");
    return {
      kind: "red",
      title: "STOP BUYING CARB PARTS.",
      body:
        `Your engine core is not a driveway fix (${bits.join("; ")}). A shop rebuild will often exceed the tool's value — keep it for spare parts or replace it.`,
    };
  }

  if (compression === "yes" && fired === "yes" && unscratched === "yes" && uncracked === "yes") {
    return {
      kind: "green",
      title: "DO NOT TAKE THIS TO A SHOP.",
      body:
        "Your engine core is healthy. Total DIY fix cost is usually $0–$18 (spark plug wire, carb diaphragm, fuel line, or tuning). Work the Diagnose tab cheapest-fix-first.",
    };
  }

  if (fired === "no" && compression === "yes" && uncracked === "yes") {
    return {
      kind: "amber",
      title: "Core looks intact — chase spark and fuel, not a rebuild",
      body:
        unscratched === "unchecked"
          ? "It did not fire on the wet test, but compression is present and the case is uncracked. Check spark (plug, boot, kill switch, coil) and fuel delivery before a shop. Peek at the piston through the exhaust port if those cheap checks fail, so you are not buying parts for a scored cylinder."
          : "It did not fire on the wet test, but compression is present, the cylinder looks clean, and the case is uncracked. This is a spark or ignition problem (plug, boot, kill switch, coil) more often than a shop rebuild.",
    };
  }

  return {
    kind: "amber",
    title: "Engine core is likely healthy — inspect before you spend",
    body:
      "Compression is present and the case is uncracked, but the cylinder has not been visually checked. Do the cheap fuel and spark fixes first, and look through the exhaust port before you pay a shop or keep buying carb kits.",
  };
}
