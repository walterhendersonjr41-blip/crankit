import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { FREE_GARAGE_TOOL_LIMIT } from "./config/monetization";
import { isProUnlocked as readPro, setProUnlocked as writePro } from "./lib/pro";
import {
  type FuelBatch,
  type GarageTool,
  type HistoryEntry,
  loadBatches,
  loadHistory,
  loadTools,
  saveBatches,
  saveHistory,
  saveTools,
} from "./lib/storage";

export type TabId = "diagnose" | "carb" | "fuel" | "garage" | "shop";

type AppState = {
  tab: TabId;
  setTab: (tab: TabId) => void;
  tools: GarageTool[];
  setTools: (tools: GarageTool[]) => void;
  batches: FuelBatch[];
  setBatches: (batches: FuelBatch[]) => void;
  history: HistoryEntry[];
  addHistory: (entry: Omit<HistoryEntry, "id" | "at"> & { id?: string; at?: string }) => void;
  clearHistory: () => void;
  isPro: boolean;
  refreshPro: () => void;
  grantPro: () => void;
  canAddTool: (upcomingCount?: number) => boolean;
  showPro: boolean;
  openPro: (reason?: string) => void;
  closePro: () => void;
  proReason: string;
  carbFocus: "tuner" | null;
  openCarbTuner: () => void;
  clearCarbFocus: () => void;
};

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<TabId>("diagnose");
  const [tools, setToolsState] = useState<GarageTool[]>(() => loadTools());
  const [batches, setBatchesState] = useState<FuelBatch[]>(() => loadBatches());
  const [history, setHistoryState] = useState<HistoryEntry[]>(() => loadHistory());
  const [isPro, setIsPro] = useState(() => readPro());
  const [showPro, setShowPro] = useState(false);
  const [proReason, setProReason] = useState("");
  const [carbFocus, setCarbFocus] = useState<"tuner" | null>(null);

  const setTools = useCallback((next: GarageTool[]) => {
    setToolsState(next);
    saveTools(next);
  }, []);

  const setBatches = useCallback((next: FuelBatch[]) => {
    setBatchesState(next);
    saveBatches(next);
  }, []);

  const addHistory = useCallback((entry: Omit<HistoryEntry, "id" | "at"> & { id?: string; at?: string }) => {
    setHistoryState((prev) => {
      const next: HistoryEntry[] = [
        {
          id: entry.id ?? `hist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          at: entry.at ?? new Date().toISOString(),
          toolId: entry.toolId,
          toolName: entry.toolName,
          toolType: entry.toolType,
          treeId: entry.treeId,
          treeTitle: entry.treeTitle,
          stepId: entry.stepId,
          stepTitle: entry.stepTitle,
          outcome: entry.outcome,
          note: entry.note,
        },
        ...prev,
      ].slice(0, 200);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistoryState([]);
    saveHistory([]);
  }, []);

  const refreshPro = useCallback(() => setIsPro(readPro()), []);
  const grantPro = useCallback(() => {
    writePro(true);
    setIsPro(true);
  }, []);

  const canAddTool = useCallback(
    (upcomingCount?: number) => {
      if (isPro) return true;
      const count = upcomingCount ?? tools.length + 1;
      return count <= FREE_GARAGE_TOOL_LIMIT;
    },
    [isPro, tools.length],
  );

  const openPro = useCallback((reason?: string) => {
    setProReason(reason ?? "");
    setShowPro(true);
  }, []);
  const closePro = useCallback(() => setShowPro(false), []);
  const openCarbTuner = useCallback(() => {
    setTab("carb");
    setCarbFocus("tuner");
  }, []);
  const clearCarbFocus = useCallback(() => setCarbFocus(null), []);

  const value = useMemo(
    () => ({
      tab,
      setTab,
      tools,
      setTools,
      batches,
      setBatches,
      history,
      addHistory,
      clearHistory,
      isPro,
      refreshPro,
      grantPro,
      canAddTool,
      showPro,
      openPro,
      closePro,
      proReason,
      carbFocus,
      openCarbTuner,
      clearCarbFocus,
    }),
    [
      tab,
      tools,
      setTools,
      batches,
      setBatches,
      history,
      addHistory,
      clearHistory,
      isPro,
      refreshPro,
      grantPro,
      canAddTool,
      showPro,
      openPro,
      closePro,
      proReason,
      carbFocus,
      openCarbTuner,
      clearCarbFocus,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
