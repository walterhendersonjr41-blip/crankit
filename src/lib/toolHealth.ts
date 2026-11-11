import { useEffect, useState } from "react";
import type { ModelSpec } from "../data/modelSpecs";
import { MODEL_SPECS } from "../data/modelSpecs";
import { officialIdleTarget, officialWotTarget } from "./engineSanity";
import { redactPersonal } from "./shareFix";
import { STORAGE_KEYS, newId, type GarageTool, type HistoryEntry } from "./storage";
import { loadWins, type RepairWin } from "./wins";
import type { MissPattern } from "./missDetect";

export const HEALTH_CHANGED_EVENT = "crankit-health-changed";

export const HEALTH_FORMULA =
  "Health Score is a weighted average, shown as a whole-number percent — phone-mic precision does not justify decimals. Idle closeness 25%, idle stability 20%, WOT vs target 25%, miss rate 20%, and rev-up time 10%. Missing pieces are dropped and the rest are re-weighted. For a stock machine, idle and WOT targets come from the official model spec when we have one, otherwise from the first health check (the baseline). If you swap in a known engine from the official list, we judge that engine against ITS stock specs — a stock engine that is running correctly should match its own manual, regardless of the machine it is in. Own-baseline drift (stability, WOT vs your first confirmed reading, miss rate, and rev-up) is used only when the installed engine is unknown or you mark it Modified (cam, carb, porting, etc.). A small RPM change or miss rate barely moves the internal score, so a healthy tool can still read 99% from day one through later checks.";

export type HealthCheck = {
  id: string;
  at: string;
  toolId: string;
  idleRpm?: number;
  idleStability?: number;
  wotRpm?: number;
  missRate?: number;
  missPattern?: MissPattern;
  revUpMs?: number;
  engineHot?: boolean;
  score: number;
  isBaseline: boolean;
  confirmedMismatch?: boolean;
  custom?: boolean;
};

export type ToolCustomSetup = {
  enabled: boolean;
  /** What engine is actually installed, in the user’s words. */
  installedEngine?: string;
  /** Official modelSpecs id when the installed engine was picked from the list. */
  installedSpecId?: string;
  /** True when the installed engine is modified (cam, carb, porting, etc.). */
  modified?: boolean;
  /** User-entered max / governed RPM for the installed engine. */
  maxRpm?: number;
  /** How many times they confirmed “Yes, it’s right” on a mismatch. */
  confirmCount: number;
};

export type ToolHealthRecord = {
  toolId: string;
  custom?: ToolCustomSetup;
  checks: HealthCheck[];
};

function readAll(): ToolHealthRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.health);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ToolHealthRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: ToolHealthRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.health, JSON.stringify(rows.slice(0, 80).map((r) => ({
      ...r,
      checks: r.checks.slice(0, 200),
    }))));
  } catch {
    // ignore quota
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(HEALTH_CHANGED_EVENT));
  }
}

export function loadHealthRecord(toolId: string): ToolHealthRecord | undefined {
  return readAll().find((r) => r.toolId === toolId);
}

export function loadAllHealth(): ToolHealthRecord[] {
  return readAll();
}

function upsertRecord(next: ToolHealthRecord): void {
  const all = readAll();
  const i = all.findIndex((r) => r.toolId === next.toolId);
  if (i >= 0) all[i] = next;
  else all.unshift(next);
  writeAll(all);
}

export function isCustomTool(toolId?: string): boolean {
  if (!toolId) return false;
  return Boolean(loadHealthRecord(toolId)?.custom?.enabled);
}

export function getCustomSetup(toolId?: string): ToolCustomSetup | undefined {
  if (!toolId) return undefined;
  return loadHealthRecord(toolId)?.custom;
}

export function setCustomSetup(toolId: string, patch: Partial<ToolCustomSetup>): ToolCustomSetup {
  const rec = loadHealthRecord(toolId) ?? { toolId, checks: [] };
  const prev = rec.custom;
  const custom: ToolCustomSetup = {
    enabled: patch.enabled ?? prev?.enabled ?? false,
    installedEngine: "installedEngine" in patch ? patch.installedEngine : prev?.installedEngine,
    installedSpecId: "installedSpecId" in patch ? patch.installedSpecId : prev?.installedSpecId,
    modified: "modified" in patch ? patch.modified : prev?.modified,
    maxRpm: "maxRpm" in patch ? patch.maxRpm : prev?.maxRpm,
    confirmCount: patch.confirmCount ?? prev?.confirmCount ?? 0,
  };
  upsertRecord({ ...rec, custom });
  return custom;
}

export function recordMismatchConfirm(toolId: string): ToolCustomSetup {
  const rec = loadHealthRecord(toolId) ?? { toolId, checks: [] };
  const count = (rec.custom?.confirmCount ?? 0) + 1;
  return setCustomSetup(toolId, { ...(rec.custom ?? { enabled: false, confirmCount: 0 }), confirmCount: count });
}

export function markToolCustom(
  toolId: string,
  fields?: { installedEngine?: string; installedSpecId?: string; modified?: boolean; maxRpm?: number },
): ToolCustomSetup {
  return setCustomSetup(toolId, {
    enabled: true,
    confirmCount: Math.max(2, loadHealthRecord(toolId)?.custom?.confirmCount ?? 0),
    installedEngine: fields?.installedEngine,
    installedSpecId: fields?.installedSpecId,
    modified: fields?.modified,
    maxRpm: fields?.maxRpm,
  });
}

/** Own-baseline drift only when the swap is unknown or marked modified. */
export function usesOwnBaseline(custom?: ToolCustomSetup): boolean {
  if (!custom?.enabled) return false;
  if (custom.modified) return true;
  return !custom.installedSpecId;
}

export function installedEngineSpec(custom?: ToolCustomSetup): ModelSpec | undefined {
  if (!custom?.enabled || custom.modified || !custom.installedSpecId) return undefined;
  return MODEL_SPECS.find((s) => s.id === custom.installedSpecId);
}

/** Spec used for scoring and tuner verdicts after a swap is identified. */
export function scoringSpec(machineSpec?: ModelSpec, custom?: ToolCustomSetup): ModelSpec | undefined {
  if (custom?.enabled) {
    if (usesOwnBaseline(custom)) return undefined;
    return installedEngineSpec(custom);
  }
  return machineSpec;
}

export function machineWithEngineLine(machine: string, setup?: ToolCustomSetup): string {
  const machineName = machine.trim() || "this machine";
  if (!setup?.enabled) return machineName;
  const engine = setup.installedEngine?.trim() || (setup.installedSpecId ? MODEL_SPECS.find((s) => s.id === setup.installedSpecId)?.name : "") || "unlisted engine";
  const mod = setup.modified ? " (modified)" : "";
  return `Machine ${machineName} with engine ${engine}${mod}`;
}

export function clampScore(n: number): number {
  const x = Math.min(100, Math.max(0, n));
  return Math.round(x * 10) / 10;
}

export function formatHealthScore(score: number): string {
  const n = Math.round(Math.min(100, Math.max(0, score)));
  return `${n}%`;
}

/** Format a timestamp as M/D/YY in the user's local zone. */
export function formatHealthDate(iso: string, now = new Date(iso)): string {
  const d = Number.isNaN(now.getTime()) ? new Date(iso) : now;
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}

function closenessScore(value: number, target: number, loose = 2.5, overPenalty?: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) return Number.NaN;
  const off = (value - target) / target;
  const weight = off > 0 && overPenalty != null ? overPenalty : loose;
  return clampScore(100 - Math.abs(off) * 100 * weight);
}

function stabilityScore(cv: number): number {
  if (!Number.isFinite(cv) || cv < 0) return Number.NaN;
  // 0% CV = 100; 1% CV ≈ 99.6 so healthy tools stay in the high 99s.
  return clampScore(100 - cv * 40);
}

function missScore(rate: number): number {
  if (!Number.isFinite(rate) || rate < 0) return Number.NaN;
  // 0% miss = 100, 25% miss = 0.
  return clampScore(100 - rate * 100 * 4);
}

function revUpScore(ms: number, baselineMs: number): number {
  if (!Number.isFinite(ms) || !Number.isFinite(baselineMs) || baselineMs <= 0) return Number.NaN;
  const slower = Math.max(0, (ms - baselineMs) / baselineMs);
  return clampScore(100 - slower * 100 * 2);
}

export type ScoreInputs = {
  idleRpm?: number;
  idleStability?: number;
  wotRpm?: number;
  missRate?: number;
  revUpMs?: number;
  spec?: ModelSpec;
  baseline?: HealthCheck;
  custom?: boolean | ToolCustomSetup;
};

/**
 * Weighted health score. Stock machines use official specs when present, else the
 * first baseline check. A known, unmodified swapped engine is judged against that
 * engine’s stock specs. Unknown or modified swaps use own-baseline drift.
 */
export function computeHealthScore(input: ScoreInputs): number {
  const setup: ToolCustomSetup | undefined =
    typeof input.custom === "object" && input.custom ? input.custom : input.custom ? { enabled: true, confirmCount: 0 } : undefined;
  const spec = scoringSpec(input.spec, setup);
  const own = usesOwnBaseline(setup);
  const idleTarget = own ? input.baseline?.idleRpm : (officialIdleTarget(spec) ?? input.baseline?.idleRpm);
  const wotTarget = own ? input.baseline?.wotRpm : (officialWotTarget(spec) ?? input.baseline?.wotRpm);

  const parts: { weight: number; score: number }[] = [];
  if (input.idleRpm != null && idleTarget != null) {
    parts.push({ weight: 25, score: closenessScore(input.idleRpm, idleTarget) });
  }
  if (input.idleStability != null) {
    parts.push({ weight: 20, score: stabilityScore(input.idleStability) });
  }
  if (input.wotRpm != null && wotTarget != null) {
    parts.push({ weight: 25, score: closenessScore(input.wotRpm, wotTarget, 2, 4) });
  }
  if (input.missRate != null) {
    parts.push({ weight: 20, score: missScore(input.missRate) });
  }
  if (input.revUpMs != null && input.baseline?.revUpMs != null) {
    parts.push({ weight: 10, score: revUpScore(input.revUpMs, input.baseline.revUpMs) });
  }
  const usable = parts.filter((p) => Number.isFinite(p.score));
  if (usable.length === 0) return 100;
  const w = usable.reduce((s, p) => s + p.weight, 0);
  const total = usable.reduce((s, p) => s + p.score * p.weight, 0);
  return clampScore(total / w);
}

export function firstBaseline(toolId: string): HealthCheck | undefined {
  return loadHealthRecord(toolId)?.checks.filter((c) => c.isBaseline).sort((a, b) => a.at.localeCompare(b.at))[0]
    ?? loadHealthRecord(toolId)?.checks.slice().sort((a, b) => a.at.localeCompare(b.at))[0];
}

export function saveHealthCheck(
  input: Omit<HealthCheck, "id" | "at" | "score" | "isBaseline"> & {
    id?: string;
    at?: string;
    spec?: ModelSpec;
    /** When false, the check is not written (mismatch not confirmed). */
    allowSave?: boolean;
  },
): HealthCheck | undefined {
  if (input.allowSave === false) return undefined;
  const rec = loadHealthRecord(input.toolId) ?? { toolId: input.toolId, checks: [] };
  const setup = rec.custom;
  const custom = Boolean(setup?.enabled);
  const existing = rec.checks.slice().sort((a, b) => a.at.localeCompare(b.at));
  const baseline = existing[0];
  const isBaseline = existing.length === 0;
  const score = computeHealthScore({
    idleRpm: input.idleRpm,
    idleStability: input.idleStability,
    wotRpm: input.wotRpm,
    missRate: input.missRate,
    revUpMs: input.revUpMs,
    spec: input.spec,
    baseline,
    custom: setup,
  });
  const check: HealthCheck = {
    id: input.id ?? newId("health"),
    at: input.at ?? new Date().toISOString(),
    toolId: input.toolId,
    idleRpm: input.idleRpm,
    idleStability: input.idleStability,
    wotRpm: input.wotRpm,
    missRate: input.missRate,
    missPattern: input.missPattern,
    revUpMs: input.revUpMs,
    engineHot: input.engineHot,
    score,
    isBaseline,
    confirmedMismatch: input.confirmedMismatch,
    custom,
  };
  upsertRecord({ ...rec, custom: rec.custom, checks: [check, ...rec.checks] });
  return check;
}

export function deleteHealthCheck(toolId: string, checkId: string): void {
  const rec = loadHealthRecord(toolId);
  if (!rec) return;
  upsertRecord({ ...rec, checks: rec.checks.filter((c) => c.id !== checkId) });
}

export type TimelineItem = {
  id: string;
  at: string;
  kind: "health" | "win" | "repair";
  title: string;
  detail: string;
  score?: number;
  check?: HealthCheck;
  win?: RepairWin;
  repair?: HistoryEntry;
};

export function toolTimeline(
  toolId: string,
  opts: { wins?: RepairWin[]; repairs?: HistoryEntry[] } = {},
): TimelineItem[] {
  const rec = loadHealthRecord(toolId);
  const items: TimelineItem[] = [];
  for (const c of rec?.checks ?? []) {
    const bits = [
      c.isBaseline ? "Baseline" : null,
      c.custom ? "Custom / engine swap" : null,
      c.idleRpm != null ? `idle ${Math.round(c.idleRpm).toLocaleString()} RPM` : null,
      c.wotRpm != null ? `WOT ${Math.round(c.wotRpm).toLocaleString()} RPM` : null,
      c.missRate != null ? `miss ${Math.round(c.missRate * 1000) / 10}%` : null,
      c.revUpMs != null ? `rev-up ${(c.revUpMs / 1000).toFixed(2)} s` : null,
    ].filter(Boolean);
    items.push({
      id: c.id,
      at: c.at,
      kind: "health",
      title: `Health check ${formatHealthScore(c.score)}`,
      detail: bits.join(" · "),
      score: c.score,
      check: c,
    });
  }
  const wins = (opts.wins ?? loadWins()).filter((w) => w.toolId === toolId);
  for (const w of wins) {
    items.push({
      id: w.id,
      at: w.at,
      kind: "win",
      title: "FIXED IT!",
      detail: [w.symptom, w.fix].filter(Boolean).join(" — "),
      win: w,
    });
  }
  for (const r of opts.repairs ?? []) {
    if (r.toolId !== toolId) continue;
    items.push({
      id: r.id,
      at: r.at,
      kind: "repair",
      title: r.outcome === "fixed" ? "Repair logged" : r.treeTitle,
      detail: [r.stepTitle, r.note].filter(Boolean).join(" — "),
      repair: r,
    });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

export function customLabel(setup?: ToolCustomSetup, machineName?: string): string {
  if (!setup?.enabled) return "";
  return machineWithEngineLine(machineName || "", setup);
}

export function toolHistoryReportText(args: {
  tool: Pick<GarageTool, "name" | "brandModel" | "toolType" | "brand">;
  makeModel: string;
  record?: ToolHealthRecord;
  timeline: TimelineItem[];
}): string {
  const machine = args.makeModel || args.tool.brandModel || args.tool.name || "";
  const heading = args.record?.custom?.enabled
    ? machineWithEngineLine(machine, args.record.custom)
    : redactPersonal(machine);
  const lines = [
    "Tool history report",
    "",
    `Type: ${args.tool.toolType}`,
    heading,
    "",
    "Health checks",
  ].filter((l) => l != null) as string[];
  const checks = [...(args.record?.checks ?? [])].sort((a, b) => a.at.localeCompare(b.at));
  if (checks.length === 0) lines.push("No health checks saved.");
  for (const c of checks) {
    lines.push(
      `${formatHealthDate(c.at)}  ${formatHealthScore(c.score)}` +
        (c.isBaseline ? "  (baseline)" : "") +
        (c.custom ? "  custom" : ""),
    );
    const bits = [
      c.idleRpm != null ? `idle ${Math.round(c.idleRpm)} RPM` : null,
      c.idleStability != null ? `stability CV ${(c.idleStability * 100).toFixed(1)}%` : null,
      c.wotRpm != null ? `WOT ${Math.round(c.wotRpm)} RPM` : null,
      c.missRate != null ? `miss rate ${(c.missRate * 100).toFixed(1)}%` : null,
      c.revUpMs != null ? `rev-up ${(c.revUpMs / 1000).toFixed(2)} s` : null,
    ].filter(Boolean);
    if (bits.length) lines.push(`  ${bits.join(", ")}`);
  }
  lines.push("", "Fixes and repairs");
  const others = args.timeline.filter((t) => t.kind !== "health");
  if (others.length === 0) lines.push("None logged.");
  for (const t of others) {
    lines.push(`${formatHealthDate(t.at)}  ${t.title}: ${redactPersonal(t.detail)}`);
  }
  lines.push("", HEALTH_FORMULA);
  lines.push("This report is for selling or sharing the tool’s history. It has no owner name, email, or phone.");
  return lines.join("\n");
}

export function useHealthRecord(toolId?: string): ToolHealthRecord | undefined {
  const [rec, setRec] = useState(() => (toolId ? loadHealthRecord(toolId) : undefined));
  useEffect(() => {
    const refresh = () => setRec(toolId ? loadHealthRecord(toolId) : undefined);
    refresh();
    window.addEventListener(HEALTH_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(HEALTH_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [toolId]);
  return rec;
}

export function useAllHealth(): ToolHealthRecord[] {
  const [rows, setRows] = useState(loadAllHealth);
  useEffect(() => {
    const refresh = () => setRows(loadAllHealth());
    window.addEventListener(HEALTH_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(HEALTH_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return rows;
}
