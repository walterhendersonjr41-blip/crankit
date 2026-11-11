import { useMemo, useState } from "react";
import { HEALTH_FORMULA, formatHealthDate, formatHealthScore, machineWithEngineLine, markToolCustom, setCustomSetup, toolHistoryReportText, toolTimeline, useHealthRecord, type ToolCustomSetup } from "../lib/toolHealth";
import type { GarageTool, HistoryEntry } from "../lib/storage";
import { useWins, type RepairWin } from "../lib/wins";
import { findModelSpecById, officialMaxRpm } from "../data/modelSpecs";
import { ModelSpecPicker } from "./ModelSpecPicker";
import { useAppState } from "../state";

export function ToolHistoryCard({ tool }: { tool: GarageTool }) {
  const record = useHealthRecord(tool.id);
  const wins = useWins();
  const { history } = useAppState();
  const [showFormula, setShowFormula] = useState(false);
  const [showCustom, setShowCustom] = useState(Boolean(record?.custom?.enabled));
  const [copied, setCopied] = useState(false);
  const setup = record?.custom;
  const timeline = useMemo(
    () => toolTimeline(tool.id, { wins: wins as RepairWin[], repairs: history as HistoryEntry[] }),
    [tool.id, wins, history, record],
  );
  const checks = [...(record?.checks ?? [])].sort((a, b) => a.at.localeCompare(b.at));
  const heading = setup?.enabled
    ? machineWithEngineLine(tool.brandModel || tool.name, setup)
    : tool.brandModel || tool.name;
  const latest = checks[checks.length - 1];

  function reportText(): string {
    return toolHistoryReportText({
      tool,
      makeModel: tool.brandModel || tool.name,
      record,
      timeline,
    });
  }

  function copyReport() {
    const text = reportText();
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => printReport(),
    );
  }

  function printReport() {
    const text = reportText();
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    w.document.write(
      `<!doctype html><html><head><title>Tool history report</title></head><body><pre style="font:14px sans-serif;white-space:pre-wrap;padding:24px">${esc(text)}</pre></body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  }

  function patchCustom(patch: Partial<ToolCustomSetup> & { enabled?: boolean }) {
    if (patch.enabled) {
      markToolCustom(tool.id, {
        installedEngine: patch.installedEngine ?? setup?.installedEngine,
        installedSpecId: patch.installedSpecId ?? setup?.installedSpecId,
        modified: patch.modified ?? setup?.modified,
        maxRpm: patch.maxRpm ?? setup?.maxRpm,
      });
    } else if (patch.enabled === false) {
      setCustomSetup(tool.id, { enabled: false });
    } else {
      setCustomSetup(tool.id, { enabled: setup?.enabled ?? false, ...patch });
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-garage-orange">Tool History</p>
          <h4 className="text-sm font-black leading-snug">{heading}</h4>
          {latest ? (
            <p className="text-sm text-neutral-200">
              {formatHealthDate(latest.at)} · {formatHealthScore(latest.score)} health
              {latest.isBaseline ? " (baseline)" : ""}
            </p>
          ) : (
            <p className="text-xs text-neutral-400">No health checks yet. Run one from the sound tuner.</p>
          )}
        </div>
      </div>

      {checks.length >= 1 && <HealthChart checks={checks} />}

      <ol className="space-y-2">
        {timeline.map((item) => (
          <li key={item.id} className="border-l-2 border-white/15 pl-3 text-sm">
            <p className="text-xs text-neutral-500">{formatHealthDate(item.at)}</p>
            <p className="font-bold">{item.title}</p>
            {item.detail && <p className="text-xs leading-relaxed text-neutral-300">{item.detail}</p>}
          </li>
        ))}
      </ol>

      <button type="button" onClick={() => setShowFormula((v) => !v)} className="min-h-11 text-xs font-bold text-orange-200">
        {showFormula ? "Hide Health Score formula" : "How is the Health Score calculated?"}
      </button>
      {showFormula && <p className="text-xs leading-relaxed text-neutral-300">{HEALTH_FORMULA}</p>}

      <button type="button" onClick={() => setShowCustom((v) => !v)} className="min-h-11 text-xs font-bold text-orange-200">
        {showCustom ? "Hide custom / engine swap" : "Mark as Custom / engine swap"}
      </button>
      {showCustom && (
        <div className="space-y-2 rounded-xl border border-white/10 p-3">
          <p className="text-sm font-bold">Which engine is actually in it?</p>
          <ModelSpecPicker
            label="Installed engine from the official list"
            value={setup?.installedSpecId}
            onPick={(spec) =>
              patchCustom({
                enabled: true,
                installedSpecId: spec?.id,
                installedEngine: spec?.name ?? setup?.installedEngine,
                maxRpm: spec ? officialMaxRpm(spec) : setup?.maxRpm,
              })
            }
          />
          <label className="block text-xs font-semibold text-neutral-300">
            Or type the engine
            <input
              className="input mt-1"
              value={setup?.installedEngine ?? ""}
              placeholder="e.g. Honda GX160"
              onChange={(e) => patchCustom({ enabled: true, installedEngine: e.target.value })}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={Boolean(setup?.modified)}
              onChange={(e) => patchCustom({ enabled: true, modified: e.target.checked })}
            />
            Modified (cam, carb, porting, etc.)
          </label>
          <label className="block text-xs font-semibold text-neutral-300">
            Your max / governed RPM (optional)
            <input
              type="number"
              className="input mt-1"
              value={setup?.maxRpm ?? ""}
              onChange={(e) =>
                patchCustom({
                  enabled: true,
                  maxRpm: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
          {setup?.installedSpecId && !setup.modified && (
            <p className="text-xs text-neutral-400">
              We’ll judge {findModelSpecById(setup.installedSpecId)?.name} against its own official stock specs.
            </p>
          )}
          {setup?.enabled && (
            <button type="button" className="min-h-11 text-xs font-bold text-neutral-400" onClick={() => patchCustom({ enabled: false })}>
              Remove custom / engine-swap mark
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={copyReport} className="min-h-11 rounded-xl border border-white/20 text-xs font-bold">
          {copied ? "Copied" : "Copy tool history report"}
        </button>
        <button type="button" onClick={printReport} className="min-h-11 rounded-xl border border-white/20 text-xs font-bold">
          Print / share report
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-neutral-500">
        The report stays on this device and has no owner name, email, or phone. Handy when selling the tool used.
      </p>
    </section>
  );
}

function HealthChart({ checks }: { checks: { at: string; score: number }[] }) {
  const w = 320;
  const h = 90;
  const pad = 18;
  if (checks.length === 0) return null;
  const ys = checks.map((c) => c.score);
  const min = Math.min(90, ...ys) - 0.5;
  const max = 100;
  const span = Math.max(1, max - min);
  const x = (i: number) => pad + (checks.length === 1 ? (w - pad * 2) / 2 : (i / (checks.length - 1)) * (w - pad * 2));
  const y = (s: number) => pad + ((max - s) / span) * (h - pad * 2);
  const d = checks.map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(c.score).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" role="img" aria-label="Health score over time">
      <line x1={pad} y1={y(100)} x2={w - pad} y2={y(100)} stroke="#333" strokeWidth="1" />
      <path d={d} fill="none" stroke="#FF6B00" strokeWidth="2.5" />
      {checks.map((c, i) => (
        <circle key={c.at + i} cx={x(i)} cy={y(c.score)} r="3.5" fill="#FF6B00" />
      ))}
      <text x={pad} y={12} fill="#888" fontSize="9">
        {Math.round(max)}%
      </text>
      <text x={pad} y={h - 4} fill="#888" fontSize="9">
        {Math.round(min)}%
      </text>
    </svg>
  );
}
