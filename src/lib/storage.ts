import type { RatioId } from "./fuel";
import type { ToolType } from "../data/diagnostics";

export const STORAGE_KEYS = {
  tools: "crankit.garageTools",
  batches: "crankit.fuelBatches",
  history: "crankit.diagnosticHistory",
  chat: "crankit.mechanicChat",
  learning: "crankit.mechanicLearning",
  tips: "crankit.mechanicTips",
} as const;

export type MixRatio = RatioId | "other";

export type GarageTool = {
  id: string;
  name: string;
  toolType: ToolType;
  brandModel: string;
  /** Optional brand id (stihl, husqvarna, ...). Also detected from name/brandModel. */
  brand?: string;
  mixRatio: MixRatio;
  sparkPlugType: string;
  chainFileSize: "5/32\"" | "3/16\"" | "7/32\"" | "n/a";
  lastTuneDate: string;
  /** Optional max / no-load RPM copied from the tool’s manual by the user. */
  maxRpm?: number;
  repairNotes: string;
  isSample?: boolean;
  createdAt: string;
};

export type FuelBatch = {
  id: string;
  mixedOn: string;
  gallons: number;
  ratio: RatioId;
  octane: string;
  ethanolFree: boolean;
  stabilizerAdded: boolean;
  notes: string;
};

export type HistoryEntry = {
  id: string;
  at: string;
  toolId?: string;
  toolName?: string;
  toolType?: ToolType;
  treeId: string;
  treeTitle: string;
  stepId: string;
  stepTitle: string;
  outcome: "fixed" | "still-broken" | "branched";
  note?: string;
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

export function loadTools(): GarageTool[] {
  return readJson<GarageTool[]>(STORAGE_KEYS.tools, []);
}

export function saveTools(tools: GarageTool[]): void {
  writeJson(STORAGE_KEYS.tools, tools);
}

export function loadBatches(): FuelBatch[] {
  return readJson<FuelBatch[]>(STORAGE_KEYS.batches, []);
}

export function saveBatches(batches: FuelBatch[]): void {
  writeJson(STORAGE_KEYS.batches, batches);
}

export function loadHistory(): HistoryEntry[] {
  return readJson<HistoryEntry[]>(STORAGE_KEYS.history, []);
}

export function saveHistory(history: HistoryEntry[]): void {
  writeJson(STORAGE_KEYS.history, history);
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const SAMPLE_FLEET: Omit<GarageTool, "id" | "createdAt">[] = [
  {
    name: "Chainsaw #1",
    toolType: "chainsaw",
    brandModel: "16-inch driveway saw",
    mixRatio: "50:1",
    sparkPlugType: "BPMR7A / RCJ7Y class",
    chainFileSize: "5/32\"",
    lastTuneDate: "",
    repairNotes: "",
    isSample: true,
  },
  {
    name: "Chainsaw #2",
    toolType: "chainsaw",
    brandModel: "18-inch woodlot saw",
    mixRatio: "50:1",
    sparkPlugType: "BPMR7A / RCJ7Y class",
    chainFileSize: "3/16\"",
    lastTuneDate: "",
    repairNotes: "",
    isSample: true,
  },
  {
    name: "Weed Eater #1",
    toolType: "weed-eater",
    brandModel: "Front-yard trimmer",
    mixRatio: "50:1",
    sparkPlugType: "RCJ6Y class",
    chainFileSize: "n/a",
    lastTuneDate: "",
    repairNotes: "",
    isSample: true,
  },
  {
    name: "Weed Eater #2",
    toolType: "weed-eater",
    brandModel: "Fence-line trimmer",
    mixRatio: "40:1",
    sparkPlugType: "RCJ6Y class",
    chainFileSize: "n/a",
    lastTuneDate: "",
    repairNotes: "",
    isSample: true,
  },
  {
    name: "Weed Eater #3",
    toolType: "weed-eater",
    brandModel: "Ditch trimmer",
    mixRatio: "50:1",
    sparkPlugType: "RCJ6Y class",
    chainFileSize: "n/a",
    lastTuneDate: "",
    repairNotes: "",
    isSample: true,
  },
  {
    name: "Weed Eater #4",
    toolType: "weed-eater",
    brandModel: "Backup trimmer",
    mixRatio: "40:1",
    sparkPlugType: "RCJ6Y class",
    chainFileSize: "n/a",
    lastTuneDate: "",
    repairNotes: "",
    isSample: true,
  },
];

export function buildSampleFleet(): GarageTool[] {
  const now = new Date().toISOString();
  return SAMPLE_FLEET.map((t, i) => ({
    ...t,
    id: `sample-${i + 1}`,
    createdAt: now,
    isSample: true,
  }));
}
