import { useEffect, useState } from "react";
import { brandForTool } from "../data/brands";
import { STORAGE_KEYS, newId, type GarageTool } from "./storage";

export const FIX_OUTCOMES_CHANGED_EVENT = "crankit-fix-outcomes-changed";

export type RanResult = "yes" | "no" | "partly";

export type FixOutcome = {
  id: string;
  at: string;
  toolId?: string;
  toolType?: string;
  make: string;
  model: string;
  symptom: string;
  testDone: string;
  fix: string;
  ran: RanResult;
};

const MAX_ENTRIES = 400;

function readOutcomes(): FixOutcome[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.fixOutcomes);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FixOutcome[];
    return Array.isArray(parsed) ? parsed.filter(isFixOutcome) : [];
  } catch {
    return [];
  }
}

function isFixOutcome(row: FixOutcome): row is FixOutcome {
  return Boolean(row && typeof row.id === "string" && typeof row.symptom === "string" && typeof row.fix === "string");
}

function writeOutcomes(rows: FixOutcome[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.fixOutcomes, JSON.stringify(rows.slice(0, MAX_ENTRIES)));
  } catch {
    // ignore quota
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FIX_OUTCOMES_CHANGED_EVENT));
  }
}

export function loadFixOutcomes(): FixOutcome[] {
  return readOutcomes();
}

export function modelKey(make: string, model: string): string {
  return [make, model]
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean)
    .join(" ") || "unspecified";
}

export function modelDisplayName(make: string, model: string): string {
  return [make.trim(), model.trim()].filter(Boolean).join(" ") || "Unspecified model";
}

export function makeModelFromTool(tool?: Pick<GarageTool, "brand" | "brandModel" | "name"> | null): {
  make: string;
  model: string;
} {
  if (!tool) return { make: "", model: "" };
  const brand = brandForTool(tool);
  return {
    make: (brand?.name ?? tool.brand ?? "").trim(),
    model: (tool.brandModel ?? "").trim(),
  };
}

export function recordFixOutcome(input: {
  toolId?: string;
  toolType?: string;
  make: string;
  model: string;
  symptom: string;
  testDone: string;
  fix: string;
  ran: RanResult;
  at?: string;
  id?: string;
}): FixOutcome {
  const entry: FixOutcome = {
    id: input.id ?? newId("fix"),
    at: input.at ?? new Date().toISOString(),
    toolId: input.toolId,
    toolType: input.toolType,
    make: input.make.trim(),
    model: input.model.trim(),
    symptom: input.symptom.trim(),
    testDone: input.testDone.trim(),
    fix: input.fix.trim(),
    ran: input.ran,
  };
  writeOutcomes([entry, ...readOutcomes()]);
  return entry;
}

export function deleteFixOutcome(id: string): void {
  writeOutcomes(readOutcomes().filter((row) => row.id !== id));
}

function normalizeFix(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export type ModelFixSummary = {
  modelKey: string;
  make: string;
  model: string;
  displayName: string;
  tried: number;
  worked: number;
  topFixes: { fix: string; workedCount: number; triedCount: number }[];
};

/** Per-model counts of fixes that actually ran (worked = ran yes). */
export function summarizeFixesByModel(entries: FixOutcome[] = loadFixOutcomes()): ModelFixSummary[] {
  const groups = new Map<string, FixOutcome[]>();
  for (const entry of entries) {
    const key = modelKey(entry.make, entry.model);
    const list = groups.get(key);
    if (list) list.push(entry);
    else groups.set(key, [entry]);
  }

  const summaries: ModelFixSummary[] = [];
  for (const [key, rows] of groups) {
    const latest = rows[0];
    const byFix = new Map<string, { fix: string; workedCount: number; triedCount: number }>();
    for (const row of rows) {
      const fixKey = normalizeFix(row.fix) || "(no fix noted)";
      const current = byFix.get(fixKey) ?? { fix: row.fix.trim() || "No fix noted", workedCount: 0, triedCount: 0 };
      current.triedCount += 1;
      if (row.ran === "yes") current.workedCount += 1;
      if (row.fix.trim() && current.fix === "No fix noted") current.fix = row.fix.trim();
      byFix.set(fixKey, current);
    }
    const topFixes = [...byFix.values()]
      .filter((f) => f.workedCount > 0)
      .sort((a, b) => b.workedCount - a.workedCount || b.triedCount - a.triedCount || a.fix.localeCompare(b.fix));
    summaries.push({
      modelKey: key,
      make: latest?.make ?? "",
      model: latest?.model ?? "",
      displayName: modelDisplayName(latest?.make ?? "", latest?.model ?? ""),
      tried: rows.length,
      worked: rows.filter((r) => r.ran === "yes").length,
      topFixes,
    });
  }

  return summaries.sort((a, b) => b.worked - a.worked || b.tried - a.tried || a.displayName.localeCompare(b.displayName));
}

export function summaryForModel(make: string, model: string, entries?: FixOutcome[]): ModelFixSummary | undefined {
  const key = modelKey(make, model);
  return summarizeFixesByModel(entries).find((s) => s.modelKey === key);
}

export type ExportableFixOutcome = {
  date: string;
  make: string;
  model: string;
  toolType: string;
  symptom: string;
  testDone: string;
  fix: string;
  ran: RanResult;
};

export function exportableFixOutcomes(entries: FixOutcome[] = loadFixOutcomes()): ExportableFixOutcome[] {
  return entries.map((row) => ({
    date: row.at,
    make: row.make,
    model: row.model,
    toolType: row.toolType ?? "",
    symptom: row.symptom,
    testDone: row.testDone,
    fix: row.fix,
    ran: row.ran,
  }));
}

export function fixOutcomesToJson(entries: FixOutcome[] = loadFixOutcomes()): string {
  return `${JSON.stringify(exportableFixOutcomes(entries), null, 2)}\n`;
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function fixOutcomesToCsv(entries: FixOutcome[] = loadFixOutcomes()): string {
  const rows = exportableFixOutcomes(entries);
  const header = ["date", "make", "model", "toolType", "symptom", "testDone", "fix", "ran"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(header.map((key) => csvCell(String(row[key as keyof ExportableFixOutcome] ?? ""))).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function downloadTextFile(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadFixOutcomes(format: "json" | "csv", entries: FixOutcome[] = loadFixOutcomes(), now = new Date()): void {
  const stamp = now.toISOString().slice(0, 10);
  if (format === "csv") {
    downloadTextFile(`crankit-what-fixed-it-${stamp}.csv`, fixOutcomesToCsv(entries), "text/csv");
    return;
  }
  downloadTextFile(`crankit-what-fixed-it-${stamp}.json`, fixOutcomesToJson(entries), "application/json");
}

export function useFixOutcomes(): FixOutcome[] {
  const [rows, setRows] = useState(loadFixOutcomes);
  useEffect(() => {
    const refresh = () => setRows(loadFixOutcomes());
    window.addEventListener(FIX_OUTCOMES_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(FIX_OUTCOMES_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return rows;
}
