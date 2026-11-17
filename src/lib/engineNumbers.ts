import { useEffect, useState } from "react";
import type { GarageTool } from "./storage";
import { STORAGE_KEYS, newId } from "./storage";
import { makeModelFromTool, modelKey } from "./fixOutcomes";

export const ENGINE_NUMBERS_CHANGED_EVENT = "crankit-engine-numbers-changed";

export const ENGINE_NUMBERS_DISCLAIMER =
  "These are general guides only, not a diagnosis for your exact engine. Compression, RPM, and plug color vary by model and condition. Confirm with a gauge and follow the manufacturer’s manual.";

export const PLUG_COLORS = ["tan/brown", "black/sooty", "white/ashy", "wet/oily"] as const;

export type PlugColor = (typeof PLUG_COLORS)[number];

export const LOW_COMPRESSION_PSI = 90;

export type EngineNumberLog = {
  id: string;
  at: string;
  toolId?: string;
  make: string;
  model: string;
  compressionPsi?: number;
  wotRpm?: number;
  plugColor?: PlugColor;
  engineHours?: number;
  notes: string;
};

const MAX_ENTRIES = 400;

function isPlugColor(value: unknown): value is PlugColor {
  return typeof value === "string" && (PLUG_COLORS as readonly string[]).includes(value);
}

function readLogs(): EngineNumberLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.engineNumbers);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EngineNumberLog[];
    return Array.isArray(parsed) ? parsed.filter((row) => row && typeof row.id === "string") : [];
  } catch {
    return [];
  }
}

function writeLogs(rows: EngineNumberLog[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.engineNumbers, JSON.stringify(rows.slice(0, MAX_ENTRIES)));
  } catch {
    // ignore quota
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ENGINE_NUMBERS_CHANGED_EVENT));
  }
}

export function loadEngineNumbers(): EngineNumberLog[] {
  return readLogs();
}

/** Parse a non-negative number. Empty or invalid input returns undefined. */
export function parseOptionalNumber(raw: string | number | undefined | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? raw : undefined;
  const n = Number(String(raw).replace(/[, ]/g, ""));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export function recordEngineNumbers(input: {
  toolId?: string;
  make: string;
  model: string;
  compressionPsi?: number;
  wotRpm?: number;
  plugColor?: PlugColor | "";
  engineHours?: number;
  notes?: string;
  at?: string;
  id?: string;
}): EngineNumberLog {
  const plug = isPlugColor(input.plugColor) ? input.plugColor : undefined;
  const entry: EngineNumberLog = {
    id: input.id ?? newId("eng"),
    at: input.at ?? new Date().toISOString(),
    toolId: input.toolId,
    make: input.make.trim(),
    model: input.model.trim(),
    compressionPsi: input.compressionPsi,
    wotRpm: input.wotRpm,
    plugColor: plug,
    engineHours: input.engineHours,
    notes: (input.notes ?? "").trim(),
  };
  writeLogs([entry, ...readLogs()]);
  return entry;
}

export function deleteEngineNumberLog(id: string): void {
  writeLogs(readLogs().filter((row) => row.id !== id));
}

export function engineLogsForModel(
  make: string,
  model: string,
  entries: EngineNumberLog[] = loadEngineNumbers(),
): EngineNumberLog[] {
  const key = modelKey(make, model);
  return entries.filter((row) => modelKey(row.make, row.model) === key);
}

export function engineNumberHints(log: Pick<EngineNumberLog, "compressionPsi" | "plugColor">): string[] {
  const hints: string[] = [];
  if (log.compressionPsi != null && log.compressionPsi < LOW_COMPRESSION_PSI) {
    hints.push("Compression under ~90 PSI often means worn rings or a worn cylinder.");
  }
  if (log.plugColor === "white/ashy") {
    hints.push("A white or ashy plug often means the mix is running lean or the engine is too hot.");
  }
  if (log.plugColor === "black/sooty") {
    hints.push("A black or sooty plug often means a rich mix, too much oil, or a stuck / used choke.");
  }
  if (log.plugColor === "tan/brown") {
    hints.push("Tan or brown is typically a healthy plug color.");
  }
  if (log.plugColor === "wet/oily") {
    hints.push("A wet or oily plug can mean flooding, too much oil in the mix, or a leaking seal.");
  }
  return hints;
}

export function hasEngineNumberValues(
  input: Pick<EngineNumberLog, "compressionPsi" | "wotRpm" | "plugColor" | "engineHours" | "notes">,
): boolean {
  return (
    input.compressionPsi != null ||
    input.wotRpm != null ||
    Boolean(input.plugColor) ||
    input.engineHours != null ||
    Boolean(input.notes?.trim())
  );
}

export function prefillFromTool(tool?: GarageTool | null): { make: string; model: string; toolId?: string } {
  const { make, model } = makeModelFromTool(tool);
  return { make, model, toolId: tool?.id };
}

export function useEngineNumbers(): EngineNumberLog[] {
  const [rows, setRows] = useState(loadEngineNumbers);
  useEffect(() => {
    const refresh = () => setRows(loadEngineNumbers());
    window.addEventListener(ENGINE_NUMBERS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ENGINE_NUMBERS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return rows;
}
