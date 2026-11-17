import { useEffect, useMemo, useState } from "react";
import {
  ENGINE_NUMBERS_DISCLAIMER,
  PLUG_COLORS,
  deleteEngineNumberLog,
  engineNumberHints,
  hasEngineNumberValues,
  parseOptionalNumber,
  prefillFromTool,
  recordEngineNumbers,
  useEngineNumbers,
  type PlugColor,
} from "../lib/engineNumbers";
import { modelDisplayName } from "../lib/fixOutcomes";
import type { GarageTool } from "../lib/storage";

export function EngineNumbersCard({ tools }: { tools: GarageTool[] }) {
  const logs = useEngineNumbers();
  const [toolId, setToolId] = useState(tools[0]?.id ?? "");
  const selected = tools.find((t) => t.id === toolId);
  const prefill = useMemo(() => prefillFromTool(selected), [selected]);
  const [make, setMake] = useState(prefill.make);
  const [model, setModel] = useState(prefill.model);
  const [psi, setPsi] = useState("");
  const [wot, setWot] = useState("");
  const [plugColor, setPlugColor] = useState<PlugColor | "">("");
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [savedHints, setSavedHints] = useState<string[] | null>(null);

  useEffect(() => {
    setToolId((current) => (tools.some((t) => t.id === current) ? current : tools[0]?.id ?? ""));
  }, [tools]);

  useEffect(() => {
    setMake(prefill.make);
    setModel(prefill.model);
  }, [prefill.make, prefill.model]);

  function resetForm() {
    setPsi("");
    setWot("");
    setPlugColor("");
    setHours("");
    setNotes("");
    setError("");
  }

  function save() {
    const compressionPsi = parseOptionalNumber(psi);
    const wotRpm = parseOptionalNumber(wot);
    const engineHours = parseOptionalNumber(hours);
    if (psi.trim() && compressionPsi == null) {
      setError("Compression must be a number, or leave it blank.");
      return;
    }
    if (wot.trim() && wotRpm == null) {
      setError("WOT RPM must be a number, or leave it blank.");
      return;
    }
    if (hours.trim() && engineHours == null) {
      setError("Engine hours must be a number, or leave it blank.");
      return;
    }
    const entry = {
      compressionPsi,
      wotRpm,
      plugColor: plugColor || undefined,
      engineHours,
      notes,
    };
    if (!hasEngineNumberValues(entry)) {
      setError("Add at least one reading, a plug color, or a note.");
      return;
    }
    const saved = recordEngineNumbers({
      toolId: selected?.id,
      make,
      model,
      ...entry,
    });
    setSavedHints(engineNumberHints(saved));
    resetForm();
  }

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-garage-card p-4">
      <div>
        <h3 className="font-black">Engine numbers</h3>
        <p className="text-sm text-neutral-400">
          Optional compression, wide-open-throttle RPM, plug color, and hours — tied to the engine model and kept on this device.
        </p>
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {tools.length > 0 && (
          <label className="block text-xs font-semibold text-neutral-300">
            Tool in My Garage
            <select
              className="input mt-1"
              value={selected?.id ?? ""}
              onChange={(e) => setToolId(e.target.value)}
            >
              {tools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.brandModel ? ` · ${t.brandModel}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-semibold text-neutral-300">
            Engine brand
            <input className="input mt-1" value={make} onChange={(e) => setMake(e.target.value)} placeholder="STIHL" />
          </label>
          <label className="block text-xs font-semibold text-neutral-300">
            Engine model
            <input className="input mt-1" value={model} onChange={(e) => setModel(e.target.value)} placeholder="MS 170" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-semibold text-neutral-300">
            Compression (PSI)
            <input
              className="input mt-1"
              inputMode="decimal"
              value={psi}
              onChange={(e) => setPsi(e.target.value)}
              placeholder="120"
            />
          </label>
          <label className="block text-xs font-semibold text-neutral-300">
            Wide-open-throttle RPM
            <input
              className="input mt-1"
              inputMode="numeric"
              value={wot}
              onChange={(e) => setWot(e.target.value)}
              placeholder="12500"
            />
          </label>
        </div>
        <label className="block text-xs font-semibold text-neutral-300">
          Plug color
          <select
            className="input mt-1"
            value={plugColor}
            onChange={(e) => setPlugColor(e.target.value as PlugColor | "")}
          >
            <option value="">Not noted</option>
            {PLUG_COLORS.map((color) => (
              <option key={color} value={color}>
                {color}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-neutral-300">
          Engine hours
          <input
            className="input mt-1"
            inputMode="decimal"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="optional"
          />
        </label>
        <label className="block text-xs font-semibold text-neutral-300">
          Notes
          <textarea
            className="input mt-1 min-h-20 py-3"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Gauge type, hot or cold, anything else"
          />
        </label>
        {error && <p className="text-xs font-semibold text-shop">{error}</p>}
        {savedHints && (
          <div className="space-y-1 rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-xs font-bold text-diy">Saved on this device.</p>
            {savedHints.map((hint) => (
              <p key={hint} className="text-xs leading-relaxed text-neutral-200">
                {hint}
              </p>
            ))}
          </div>
        )}
        <button type="submit" className="min-h-12 w-full rounded-xl bg-garage-orange px-4 text-sm font-black text-black">
          Save engine numbers
        </button>
      </form>

      <p className="text-[11px] leading-relaxed text-neutral-500">{ENGINE_NUMBERS_DISCLAIMER}</p>

      {logs.length === 0 ? (
        <p className="text-sm text-neutral-500">No engine numbers yet.</p>
      ) : (
        <ul className="space-y-3">
          {logs.map((log) => {
            const hints = engineNumberHints(log);
            const bits = [
              log.compressionPsi != null ? `${log.compressionPsi} PSI` : null,
              log.wotRpm != null ? `${Math.round(log.wotRpm).toLocaleString()} WOT RPM` : null,
              log.plugColor ? `plug ${log.plugColor}` : null,
              log.engineHours != null ? `${log.engineHours} hours` : null,
            ].filter(Boolean);
            return (
              <li key={log.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-sm font-bold text-white">{modelDisplayName(log.make, log.model)}</p>
                <p className="text-sm text-neutral-200">{bits.join(" · ") || "Notes only"}</p>
                {log.notes && <p className="mt-1 text-xs leading-relaxed text-neutral-300">{log.notes}</p>}
                {hints.map((hint) => (
                  <p key={hint} className="mt-1 text-xs leading-relaxed text-bolt">
                    {hint}
                  </p>
                ))}
                <p className="mt-1 text-xs text-neutral-500">{new Date(log.at).toLocaleString()}</p>
                <button
                  type="button"
                  onClick={() => deleteEngineNumberLog(log.id)}
                  className="mt-2 min-h-11 text-xs font-bold text-neutral-400"
                >
                  Remove this log
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
