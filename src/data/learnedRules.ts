import type { ToolType } from "./diagnostics";

/**
 * Reviewed community fixes, added in a release after a human reads opt-in
 * Netlify Form submissions (`shared-fixes`). Do not auto-merge submissions here.
 * The list ships empty until the first reviewed batch.
 */
export type LearnedRule = {
  id: string;
  symptom: string;
  fix: string;
  toolType?: ToolType;
  brand?: string;
  note?: string;
};

export const LEARNED_RULES: LearnedRule[] = [];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 2);
}

function related(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(tokens(na));
  const tb = tokens(nb);
  if (tb.length === 0) return false;
  return tb.filter((t) => ta.has(t)).length >= Math.min(2, tb.length);
}

export function matchLearnedRules(
  input: string,
  ctx: { toolType?: string; brand?: string } = {},
  rules: LearnedRule[] = LEARNED_RULES,
): LearnedRule[] {
  return rules
    .filter((rule) => related(input, rule.symptom) || related(input, rule.fix))
    .map((rule) => {
      const typeBonus = ctx.toolType && rule.toolType === ctx.toolType ? 2 : 0;
      const brandBonus = ctx.brand && rule.brand && ctx.brand === rule.brand ? 2 : 0;
      return { rule, score: 1 + typeBonus + brandBonus };
    })
    .sort((a, b) => b.score - a.score)
    .map((row) => row.rule);
}

export function formatLearnedRule(rule: LearnedRule): string {
  const extra = rule.note ? ` ${rule.note}` : "";
  return `Reviewed community fix: when “${rule.symptom}”, ${rule.fix}.${extra}`;
}
