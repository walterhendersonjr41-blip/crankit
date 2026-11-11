import { useMemo, useState, type ReactNode } from "react";
import { Disclaimer } from "../components/Disclaimer";
import { SafetyNote } from "../components/SafetyNote";
import { BRANDS, brandForTool } from "../data/brands";
import { STAMPED_LETTER_NOTE } from "../data/carbNotes";
import { TOOL_TYPES, type ToolType } from "../data/diagnostics";
import { daysRemaining } from "../lib/fuel";
import { FREE_GARAGE_TOOL_LIMIT } from "../config/monetization";
import { buildSampleFleet, newId, type GarageTool, type MixRatio } from "../lib/storage";
import { useAppState } from "../state";

const FILE_SIZES: GarageTool["chainFileSize"][] = ["5/32\"", "3/16\"", "7/32\"", "n/a"];
const RATIOS: MixRatio[] = ["50:1", "40:1", "32:1", "other"];

const EMPTY: Omit<GarageTool, "id" | "createdAt"> = {
  name: "",
  toolType: "chainsaw",
  brand: "",
  brandModel: "",
  mixRatio: "50:1",
  sparkPlugType: "",
  chainFileSize: "5/32\"",
  lastTuneDate: "",
  repairNotes: "",
};

export function GaragePage() {
  const { tools, setTools, batches, history, isPro, openPro } = useAppState();
  const [editing, setEditing] = useState<GarageTool | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [printToolId, setPrintToolId] = useState(tools[0]?.id ?? "");

  const reminders = useMemo(() => {
    if (!isPro) return [] as string[];
    const out: string[] = [];
    for (const t of tools) {
      if (t.lastTuneDate) {
        const last = new Date(t.lastTuneDate);
        const days = Math.floor((Date.now() - last.getTime()) / 86400000);
        if (days >= 90) out.push(`${t.name}: last tune was ${days} days ago. A fresh L/H/T check is due.`);
      }
    }
    for (const b of batches) {
      const days = daysRemaining(b.mixedOn, b.stabilizerAdded);
      if (days <= 7) {
        out.push(
          days < 0
            ? `Fuel batch (${b.gallons} gal ${b.ratio}) is ${Math.abs(days)} day(s) past its use-by date.`
            : `Fuel batch (${b.gallons} gal ${b.ratio}) has ${days} day(s) left.`,
        );
      }
    }
    return out;
  }, [isPro, tools, batches]);

  function startCreate() {
    if (!isPro && tools.length >= FREE_GARAGE_TOOL_LIMIT) {
      openPro("Free plan includes 2 garage tools");
      return;
    }
    setForm({ ...EMPTY });
    setCreating(true);
    setEditing(null);
  }

  function startEdit(tool: GarageTool) {
    setEditing(tool);
    setCreating(false);
    setForm({
      name: tool.name,
      toolType: tool.toolType,
      brand: tool.brand ?? "",
      brandModel: tool.brandModel,
      mixRatio: tool.mixRatio,
      sparkPlugType: tool.sparkPlugType,
      chainFileSize: tool.chainFileSize,
      lastTuneDate: tool.lastTuneDate,
      repairNotes: tool.repairNotes,
    });
  }

  function saveForm() {
    if (!form.name.trim()) return;
    if (creating) {
      if (!isPro && tools.length >= FREE_GARAGE_TOOL_LIMIT) {
        openPro("Free plan includes 2 garage tools");
        return;
      }
      const next: GarageTool = {
        ...form,
        name: form.name.trim(),
        brand: form.brand?.trim() || undefined,
        id: newId("tool"),
        createdAt: new Date().toISOString(),
      };
      setTools([next, ...tools]);
      setCreating(false);
      return;
    }
    if (editing) {
      setTools(tools.map((t) => (t.id === editing.id ? { ...t, ...form, name: form.name.trim(), brand: form.brand?.trim() || undefined } : t)));
      setEditing(null);
    }
  }

  function removeTool(id: string) {
    setTools(tools.filter((t) => t.id !== id));
    if (editing?.id === id) setEditing(null);
  }

  function loadSample() {
    const sample = buildSampleFleet();
    if (!isPro && sample.length > FREE_GARAGE_TOOL_LIMIT) {
      // Preview is allowed so the user can see a multi-tool garage.
      // Adding further custom tools still requires Pro.
    }
    setTools(sample);
    setPrintToolId(sample[0]?.id ?? "");
    setCreating(false);
    setEditing(null);
  }

  function exportHistory() {
    if (!isPro) {
      openPro("Export and print diagnostic history");
      return;
    }
    const lines = history.length
      ? history.map((h) => {
          const when = new Date(h.at).toLocaleString();
          const tool = h.toolName ? ` · ${h.toolName}` : "";
          return `${when}${tool}\n${h.treeTitle}\n${h.stepTitle} · ${h.outcome}${h.note ? ` · ${h.note}` : ""}`;
        })
      : ["No diagnostic history yet."];
    const text = `CrankIt diagnostic history\n\n${lines.join("\n\n")}\n`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "crankit-diagnostic-history.txt";
    a.click();
    URL.revokeObjectURL(url);
    window.setTimeout(() => {
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(`<pre style="font:14px sans-serif;white-space:pre-wrap;padding:24px">${escapeHtml(text)}</pre>`);
      w.document.close();
      w.focus();
      w.print();
    }, 250);
  }

  function printTuneSheet() {
    if (!isPro) {
      openPro("Print a carburetor tune sheet");
      return;
    }
    const tool = tools.find((t) => t.id === printToolId) ?? tools[0];
    const w = window.open("", "_blank");
    if (!w) return;
    const body = tool
      ? tuneSheetHtml(tool)
      : "<p>Add a tool to your garage first.</p>";
    w.document.write(body);
    w.document.close();
    w.focus();
    w.print();
  }

  const showForm = creating || editing;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black">My Garage</h2>
        <p className="text-sm text-neutral-400">
          Track every saw and trimmer, its mix, plug, file size, last tune, and repair notes.
          {!isPro && ` Free plan: ${FREE_GARAGE_TOOL_LIMIT} tools.`}
        </p>
      </div>

      {isPro && reminders.length > 0 && (
        <SafetyNote>
          <p className="font-bold">Maintenance reminders</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {reminders.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </SafetyNote>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={startCreate}
          className="min-h-12 rounded-xl bg-garage-orange px-4 text-sm font-black text-black"
        >
          Add a tool
        </button>
        <button
          type="button"
          onClick={loadSample}
          className="min-h-12 rounded-xl border border-white/20 px-4 text-sm font-bold"
        >
          Load sample fleet (2 chainsaws + 4 weed eaters)
        </button>
      </div>
      {!isPro && tools.length > FREE_GARAGE_TOOL_LIMIT && (
        <p className="text-sm text-neutral-400">
          Sample fleet is a preview of a full garage. Unlock Pro to keep unlimited tools and add your own beyond {FREE_GARAGE_TOOL_LIMIT}.
        </p>
      )}

      {showForm && (
        <form
          className="space-y-3 rounded-2xl border border-white/10 bg-garage-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveForm();
          }}
        >
          <h3 className="font-black">{creating ? "New tool" : "Edit tool"}</h3>
          <Field label="Name">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="Chainsaw #1"
            />
          </Field>
          <Field label="Type">
            <select
              value={form.toolType}
              onChange={(e) => setForm({ ...form, toolType: e.target.value as ToolType })}
              className="input"
            >
              {TOOL_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Brand (for mechanic tips)">
            <select
              value={form.brand ?? ""}
              onChange={(e) => setForm({ ...form, brand: e.target.value || undefined })}
              className="input"
            >
              <option value="">Detect from the name, or not listed</option>
              {BRANDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Brand / model">
            <input
              value={form.brandModel}
              onChange={(e) => setForm({ ...form, brandModel: e.target.value })}
              className="input"
              placeholder="16-inch driveway saw"
            />
          </Field>
          <Field label="Mix ratio">
            <select
              value={form.mixRatio}
              onChange={(e) => setForm({ ...form, mixRatio: e.target.value as MixRatio })}
              className="input"
            >
              {RATIOS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Spark plug type">
            <input
              value={form.sparkPlugType}
              onChange={(e) => setForm({ ...form, sparkPlugType: e.target.value })}
              className="input"
              placeholder="BPMR7A"
            />
          </Field>
          <Field label='Chain file size (30° filing angle reminder)'>
            <select
              value={form.chainFileSize}
              onChange={(e) => setForm({ ...form, chainFileSize: e.target.value as GarageTool["chainFileSize"] })}
              className="input"
            >
              {FILE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                  {s !== "n/a" ? " · file at 30°" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Last tune date">
            <input
              type="date"
              value={form.lastTuneDate}
              onChange={(e) => setForm({ ...form, lastTuneDate: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Repair notes">
            <textarea
              value={form.repairNotes}
              onChange={(e) => setForm({ ...form, repairNotes: e.target.value })}
              className="input min-h-24 py-3"
            />
          </Field>
          <div className="flex gap-2">
            <button type="submit" className="min-h-12 flex-1 rounded-xl bg-garage-orange font-black text-black">
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
              className="min-h-12 flex-1 rounded-xl border border-white/20 font-bold"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {tools.length === 0 && (
          <p className="text-sm text-neutral-500">No tools yet. Add one, or load the sample fleet to see how a multi-tool garage looks.</p>
        )}
        {tools.map((t) => (
          <article key={t.id} className="space-y-2 rounded-2xl border border-white/10 bg-garage-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-garage-orange">
                  {TOOL_TYPES.find((x) => x.id === t.toolType)?.label}
                </p>
                <h3 className="text-lg font-black leading-snug">{t.name}</h3>
                {t.brandModel && <p className="text-sm text-neutral-400">{t.brandModel}</p>}
                <BrandHint tool={t} />
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => startEdit(t)} className="min-h-11 text-sm font-bold text-orange-200">
                  Edit
                </button>
                <button type="button" onClick={() => removeTool(t.id)} className="min-h-11 text-sm font-bold text-neutral-400">
                  Delete
                </button>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <div>
                <dt className="text-neutral-500">Mix</dt>
                <dd className="font-semibold">{t.mixRatio}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Spark plug</dt>
                <dd className="font-semibold">{t.sparkPlugType || "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Chain file</dt>
                <dd className="font-semibold">
                  {t.chainFileSize}
                  {t.chainFileSize !== "n/a" ? " at 30°" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Last tune</dt>
                <dd className="font-semibold">{t.lastTuneDate ? new Date(t.lastTuneDate).toLocaleDateString() : "—"}</dd>
              </div>
            </dl>
            {t.repairNotes && (
              <pre className="whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-xs leading-relaxed text-neutral-300">
                {t.repairNotes}
              </pre>
            )}
          </article>
        ))}
      </div>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-garage-card p-4">
        <h3 className="font-black">Pro shop paperwork</h3>
        <p className="text-sm text-neutral-400">
          Export your diagnostic history or print a tune sheet for a selected tool. On the free plan these stay locked.
        </p>
        <label className="block text-sm">
          Tune sheet tool
          <select
            value={printToolId}
            onChange={(e) => setPrintToolId(e.target.value)}
            className="input mt-1"
            disabled={tools.length === 0}
          >
            {tools.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={printTuneSheet} className="min-h-12 w-full rounded-xl border border-white/20 font-bold">
          {isPro ? "Print tune sheet" : "Print tune sheet (Pro)"}
        </button>
        <button type="button" onClick={exportHistory} className="min-h-12 w-full rounded-xl border border-white/20 font-bold">
          {isPro ? "Export / print diagnostic history" : "Export / print history (Pro)"}
        </button>
        <p className="text-xs text-neutral-500">{history.length} history {history.length === 1 ? "entry" : "entries"} saved on this device.</p>
      </section>
      <section id="brand-notes" className="space-y-3 rounded-2xl border border-white/10 bg-garage-card p-4">
        <h3 className="font-black">Brand notes</h3>
        <p className="text-sm text-neutral-400">
          Typical published figures from official manuals. Facts we could not verify are omitted. Always check your model’s manual.
        </p>
        <ul className="space-y-3">
          {BRANDS.map((b) => (
            <li key={b.id} className="text-sm leading-relaxed">
              <p className="font-bold text-white">{b.name}</p>
              {b.mixRatio && <p>Mix: {b.mixRatio.value}. Check your manual.</p>}
              {b.sparkPlug && <p>Spark plug: {b.sparkPlug.value}. Check your manual.</p>}
              {b.carbMaker && <p>Carb: {b.carbMaker.value}. Check your manual.</p>}
              {b.screwHeads && <p>Screws: {b.screwHeads.value}. Check your manual.</p>}
            </li>
          ))}
        </ul>
      </section>
      <Disclaimer compact />
    </div>
  );
}

function BrandHint({ tool }: { tool: GarageTool }) {
  const brand = brandForTool(tool);
  if (!brand) return null;
  return (
    <p className="mt-1 text-xs leading-relaxed text-neutral-300">
      {brand.name} typical published figures — check your manual.
      {brand.mixRatio ? ` Mix: ${brand.mixRatio.value}.` : ""}
      {brand.sparkPlug ? ` Plug: ${brand.sparkPlug.value}.` : ""}
      {brand.carbMaker ? ` Carb: ${brand.carbMaker.value}.` : ""}
    </p>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-neutral-300">{label}</span>
      {children}
    </label>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tuneSheetHtml(tool: GarageTool): string {
  const brand = brandForTool(tool);
  const brandBlock = brand
    ? `<p><small>${escapeHtml(brand.name)} typical published figures — check your manual.`
      + (brand.mixRatio ? ` Mix: ${escapeHtml(brand.mixRatio.value)}.` : "")
      + (brand.sparkPlug ? ` Plug: ${escapeHtml(brand.sparkPlug.value)}.` : "")
      + `</small></p>`
    : "";
  return `<!doctype html><html><head><title>CrankIt tune sheet — ${escapeHtml(tool.name)}</title>
  <style>body{font-family:sans-serif;padding:24px;color:#111;max-width:640px}h1{margin:0}table{border-collapse:collapse;width:100%;margin-top:16px}td,th{border:1px solid #ccc;padding:8px;text-align:left}small{color:#444}</style>
  </head><body>
  <h1>CrankIt tune sheet</h1>
  <p><strong>${escapeHtml(tool.name)}</strong><br>${escapeHtml(tool.brandModel || "")}</p>${brandBlock}
  <table>
    <tr><th>Mix ratio</th><td>${escapeHtml(tool.mixRatio)}</td></tr>
    <tr><th>Spark plug</th><td>${escapeHtml(tool.sparkPlugType || "—")}</td></tr>
    <tr><th>Chain file</th><td>${escapeHtml(tool.chainFileSize)}${tool.chainFileSize !== "n/a" ? " at 30°" : ""}</td></tr>
    <tr><th>Last tune</th><td>${escapeHtml(tool.lastTuneDate || "—")}</td></tr>
  </table>
  <h2>Baseline reminder</h2>
  <ol>
    <li>${escapeHtml(STAMPED_LETTER_NOTE)}</li>
    <li>If limiter caps are fitted, only turn as far as they allow. Do not force them.</li>
    <li>Starting point on many (not all) carbs: lightly seat L and H, then back out 1.5 turns. Check the manual.</li>
    <li>Set T/LA so the chain or head is stopped at idle.</li>
    <li>Adjust L for a clean trigger snap (usually a little richer / CCW if it bogs).</li>
    <li>Adjust H at a safe full throttle for a slight rich burble. A lean H can score the piston.</li>
  </ol>
  <p><small>General guidance only. Follow the manufacturer’s manual for this exact tool.</small></p>
  </body></html>`;
}
