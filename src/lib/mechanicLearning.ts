import { hasMechanicSync, mechanicSync } from "../config/mechanicSync";
import { STORAGE_KEYS, newId } from "./storage";

export type LearningSource = "diagnose-fixed" | "bot-rating" | "user-tip" | "win";

export type LearningEvent = {
  id: string;
  at: string;
  toolId?: string;
  toolName?: string;
  symptomKey: string;
  symptomLabel: string;
  fixKey: string;
  fixLabel: string;
  source: LearningSource;
  helpful: boolean;
};

export type UserTip = {
  id: string;
  at: string;
  symptom: string;
  fix: string;
  toolId?: string;
  toolName?: string;
};

export type RankedFix = {
  fixKey: string;
  fixLabel: string;
  helpful: number;
  unhelpful: number;
  lastHelpfulAt?: string;
  toolId?: string;
  toolName?: string;
  score: number;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function loadEvents(): LearningEvent[] {
  return readJson<LearningEvent[]>(STORAGE_KEYS.learning, []);
}

export function loadTips(): UserTip[] {
  return readJson<UserTip[]>(STORAGE_KEYS.tips, []);
}

function saveEvents(events: LearningEvent[]): void {
  writeJson(STORAGE_KEYS.learning, events.slice(0, 400));
  void syncLearningIfEnabled();
}

function saveTips(tips: UserTip[]): void {
  writeJson(STORAGE_KEYS.tips, tips.slice(0, 100));
  void syncLearningIfEnabled();
}

export function normalizeSymptomKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function recordEvent(partial: Omit<LearningEvent, "id" | "at"> & { id?: string; at?: string }): LearningEvent {
  const event: LearningEvent = {
    ...partial,
    id: partial.id ?? newId("learn"),
    at: partial.at ?? new Date().toISOString(),
  };
  saveEvents([event, ...loadEvents()]);
  return event;
}

export function recordDiagnoseFixed(args: {
  toolId?: string;
  toolName?: string;
  treeId: string;
  treeTitle: string;
  stepId: string;
  stepTitle: string;
}): LearningEvent {
  return recordEvent({
    toolId: args.toolId,
    toolName: args.toolName,
    symptomKey: normalizeSymptomKey(args.treeId + " " + args.treeTitle),
    symptomLabel: args.treeTitle,
    fixKey: args.stepId,
    fixLabel: args.stepTitle,
    source: "diagnose-fixed",
    helpful: true,
  });
}

export function recordBotRating(args: {
  toolId?: string;
  toolName?: string;
  symptomKey: string;
  symptomLabel: string;
  fixKey: string;
  fixLabel: string;
  helpful: boolean;
}): LearningEvent {
  return recordEvent({
    ...args,
    source: "bot-rating",
  });
}

export function addUserTip(args: { symptom: string; fix: string; toolId?: string; toolName?: string }): UserTip {
  const tip: UserTip = {
    id: newId("tip"),
    at: new Date().toISOString(),
    symptom: args.symptom.trim(),
    fix: args.fix.trim(),
    toolId: args.toolId,
    toolName: args.toolName,
  };
  saveTips([tip, ...loadTips()]);
  recordEvent({
    toolId: tip.toolId,
    toolName: tip.toolName,
    symptomKey: normalizeSymptomKey(tip.symptom),
    symptomLabel: tip.symptom,
    fixKey: `tip:${tip.id}`,
    fixLabel: tip.fix,
    source: "user-tip",
    helpful: true,
  });
  return tip;
}

export function clearLearning(): void {
  writeJson(STORAGE_KEYS.learning, []);
  writeJson(STORAGE_KEYS.tips, []);
}

export function tokens(text: string): string[] {
  return normalizeSymptomKey(text)
    .split(" ")
    .filter((t) => t.length > 2);
}

function related(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const ta = new Set(tokens(a));
  const tb = tokens(b);
  if (tb.length === 0) return false;
  const overlap = tb.filter((t) => ta.has(t)).length;
  return overlap >= Math.min(2, tb.length);
}

export function rankedFixes(args: { symptomKey: string; toolId?: string }): RankedFix[] {
  const events = loadEvents();
  const buckets = new Map<string, RankedFix>();
  for (const e of events) {
    if (!related(e.symptomKey, args.symptomKey) && !related(e.symptomLabel, args.symptomKey)) continue;
    const key = `${e.toolId ?? ""}::${e.fixKey}`;
    const row =
      buckets.get(key) ??
      {
        fixKey: e.fixKey,
        fixLabel: e.fixLabel,
        helpful: 0,
        unhelpful: 0,
        toolId: e.toolId,
        toolName: e.toolName,
        score: 0,
      };
    if (e.helpful) {
      row.helpful += 1;
      if (!row.lastHelpfulAt || e.at > row.lastHelpfulAt) row.lastHelpfulAt = e.at;
    } else {
      row.unhelpful += 1;
    }
    buckets.set(key, row);
  }

  const rows = [...buckets.values()].map((row) => {
    const sameTool = args.toolId && row.toolId === args.toolId ? 8 : 0;
    row.score = row.helpful * 4 - row.unhelpful * 2 + sameTool + (row.lastHelpfulAt ? 1 : 0);
    return row;
  });

  return rows
    .filter((r) => r.helpful > 0 || r.unhelpful > 0)
    .sort((a, b) => b.score - a.score || b.helpful - a.helpful);
}

export function provenLine(fix: RankedFix, toolName?: string): string {
  const name = fix.toolName || toolName;
  const who = name ? `your ${name}` : "this tool";
  return `Last time ${who} did this, ${fix.fixLabel} worked.`;
}

export function matchTips(input: string): UserTip[] {
  const key = normalizeSymptomKey(input);
  return loadTips().filter((tip) => related(key, tip.symptom) || related(key, tip.fix));
}

/**
 * Future shared-learning hook. Does nothing while `mechanicSync.endpoint` is empty.
 */
export async function syncLearningIfEnabled(): Promise<void> {
  if (!hasMechanicSync()) return;
  const endpoint = mechanicSync.endpoint.trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = mechanicSync.apiKey.trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  try {
    await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ events: loadEvents(), tips: loadTips() }),
    });
  } catch {
    // stay local
  }
}
