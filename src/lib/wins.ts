import { useEffect, useState } from "react";
import { brandForTool } from "../data/brands";
import { recordEvent, normalizeSymptomKey } from "./mechanicLearning";
import { STORAGE_KEYS, newId } from "./storage";

export const WINS_CHANGED_EVENT = "crankit-wins-changed";

export type WinSource = "diagnose" | "mechanic" | "tuner";

export type RepairWin = {
  id: string;
  at: string;
  toolId?: string;
  toolName?: string;
  toolType?: string;
  make: string;
  model: string;
  symptom: string;
  fix: string;
  partCost: number;
  shopCostSaved: number;
  source: WinSource;
};

function readWins(): RepairWin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.wins);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RepairWin[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeWins(wins: RepairWin[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.wins, JSON.stringify(wins.slice(0, 400)));
  } catch {
    // ignore quota
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(WINS_CHANGED_EVENT));
  }
}

export function loadWins(): RepairWin[] {
  return readWins();
}

/** Parse a dollar amount. Empty or invalid input returns undefined. */
export function parseMoney(raw: string | number | undefined | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) / 100 : undefined;
  }
  const n = Number(String(raw).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100) / 100;
}

export function formatMoney(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function totalShopSaved(wins: RepairWin[]): number {
  return wins.reduce((sum, w) => sum + (w.shopCostSaved || 0), 0);
}

export function totalPartCost(wins: RepairWin[]): number {
  return wins.reduce((sum, w) => sum + (w.partCost || 0), 0);
}

/** Shop quotes avoided minus parts spent. */
export function totalSaved(wins: RepairWin[]): number {
  return Math.round((totalShopSaved(wins) - totalPartCost(wins)) * 100) / 100;
}

export function recordWin(input: {
  toolId?: string;
  toolName?: string;
  toolType?: string;
  make: string;
  model: string;
  symptom: string;
  fix: string;
  partCost?: number;
  shopCostSaved?: number;
  source: WinSource;
  at?: string;
  id?: string;
}): RepairWin {
  const win: RepairWin = {
    id: input.id ?? newId("win"),
    at: input.at ?? new Date().toISOString(),
    toolId: input.toolId,
    toolName: input.toolName,
    toolType: input.toolType,
    make: input.make.trim(),
    model: input.model.trim(),
    symptom: input.symptom.trim(),
    fix: input.fix.trim(),
    partCost: input.partCost ?? 0,
    shopCostSaved: input.shopCostSaved ?? 0,
    source: input.source,
  };
  writeWins([win, ...readWins()]);
  recordEvent({
    toolId: win.toolId,
    toolName: win.toolName,
    symptomKey: normalizeSymptomKey(win.symptom),
    symptomLabel: win.symptom,
    fixKey: `win:${win.id}`,
    fixLabel: win.fix,
    source: "win",
    helpful: true,
  });
  return win;
}

export function deleteWin(id: string): void {
  writeWins(readWins().filter((w) => w.id !== id));
}

export function makeFromTool(tool?: { brand?: string; brandModel?: string; name?: string } | null): {
  make: string;
  model: string;
} {
  if (!tool) return { make: "", model: "" };
  const brand = brandForTool(tool);
  const make = (brand?.name ?? tool.brand ?? "").trim();
  return { make, model: (tool.brandModel ?? "").trim() };
}

export function useWins(): RepairWin[] {
  const [wins, setWins] = useState(loadWins);
  useEffect(() => {
    const refresh = () => setWins(loadWins());
    window.addEventListener(WINS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(WINS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return wins;
}
