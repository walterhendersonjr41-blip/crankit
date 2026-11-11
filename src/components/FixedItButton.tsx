import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { brandForTool } from "../data/brands";
import type { GarageTool } from "../lib/storage";
import { formatMoney, parseMoney, recordWin, type WinSource } from "../lib/wins";
import { ShareFixButton } from "./ShareFixButton";

export function FixedItButton({
  source,
  tools = [],
  tool,
  toolType,
  symptom = "",
  fix = "",
  onSaved,
}: {
  source: WinSource;
  tools?: GarageTool[];
  tool?: GarageTool;
  toolType?: string;
  symptom?: string;
  fix?: string;
  onSaved?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toolId, setToolId] = useState(tool?.id ?? tools[0]?.id ?? "");
  const selected = tools.find((t) => t.id === toolId) ?? tool;
  const prefill = useMemo(() => {
    const brand = brandForTool(selected);
    return {
      make: (brand?.name ?? selected?.brand ?? "").trim(),
      model: (selected?.brandModel ?? "").trim(),
    };
  }, [selected]);
  const [make, setMake] = useState(prefill.make);
  const [model, setModel] = useState(prefill.model);
  const [symptomText, setSymptomText] = useState(symptom);
  const [fixText, setFixText] = useState(fix);
  const [partCost, setPartCost] = useState("");
  const [shopCost, setShopCost] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setToolId(tool?.id ?? tools[0]?.id ?? "");
  }, [tool?.id, tools]);

  useEffect(() => {
    if (saved) return;
    setMake(prefill.make);
    setModel(prefill.model);
  }, [prefill.make, prefill.model, saved]);

  useEffect(() => {
    if (saved) return;
    if (symptom) setSymptomText(symptom);
    if (fix) setFixText(fix);
  }, [symptom, fix, saved]);

  function save() {
    const nextSymptom = symptomText.trim();
    const nextFix = fixText.trim();
    if (!nextSymptom || !nextFix) {
      setError("Add the symptom and what actually fixed it.");
      return;
    }
    const parts = parseMoney(partCost);
    const shop = parseMoney(shopCost);
    if (partCost.trim() && parts == null) {
      setError("Part cost must be a dollar amount, or leave it blank.");
      return;
    }
    if (shopCost.trim() && shop == null) {
      setError("Shop cost saved must be a dollar amount, or leave it blank.");
      return;
    }
    const win = recordWin({
      toolId: selected?.id,
      toolName: selected?.name,
      toolType: toolType ?? selected?.toolType,
      make,
      model,
      symptom: nextSymptom,
      fix: nextFix,
      partCost: parts ?? 0,
      shopCostSaved: shop ?? 0,
      source,
    });
    setError("");
    setSaved(true);
    onSaved?.(win.id);
  }

  if (saved) {
    const parts = parseMoney(partCost) ?? 0;
    const shop = parseMoney(shopCost) ?? 0;
    return (
      <div className="space-y-2 rounded-2xl border border-diy/40 bg-diy/10 p-3">
        <p className="text-sm font-black text-green-100">Saved to My Wins in My Garage.</p>
        {(shop > 0 || parts > 0) && (
          <p className="text-xs text-neutral-300">
            Shop cost saved {formatMoney(shop)}
            {parts > 0 ? ` · parts ${formatMoney(parts)} · net ${formatMoney(shop - parts)}` : ""}.
          </p>
        )}
        {source === "tuner" && (
          <p className="text-xs text-neutral-400">No audio is stored with this win.</p>
        )}
        <ShareFixButton
          label="Share this win"
          input={{
            toolType: toolType ?? selected?.toolType,
            brandModel: [make, model].filter(Boolean).join(" "),
            symptom: symptomText,
            fix: fixText,
            worked: "yes",
          }}
        />
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-diy px-4 py-3 text-sm font-black text-black"
      >
        <CheckCircle2 className="h-5 w-5" aria-hidden />
        FIXED IT!
      </button>
    );
  }

  return (
    <form
      className="space-y-2 rounded-2xl border border-diy/40 bg-black/30 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <p className="text-sm font-black">Log this win</p>
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
          Make
          <input
            className="input mt-1"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            placeholder="ECHO, Craftsman…"
          />
        </label>
        <label className="block text-xs font-semibold text-neutral-300">
          Model
          <input
            className="input mt-1"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="GT-225, 316.791150…"
          />
        </label>
      </div>
      <label className="block text-xs font-semibold text-neutral-300">
        Symptom
        <input
          className="input mt-1"
          value={symptomText}
          onChange={(e) => setSymptomText(e.target.value)}
          placeholder="Dies when I tilt it"
        />
      </label>
      <label className="block text-xs font-semibold text-neutral-300">
        What actually fixed it (part / adjustment)
        <input
          className="input mt-1"
          value={fixText}
          onChange={(e) => setFixText(e.target.value)}
          placeholder="New in-tank fuel line"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-semibold text-neutral-300">
          Part cost
          <input
            className="input mt-1"
            inputMode="decimal"
            value={partCost}
            onChange={(e) => setPartCost(e.target.value)}
            placeholder="$0.00"
          />
        </label>
        <label className="block text-xs font-semibold text-neutral-300">
          Estimated shop cost saved
          <input
            className="input mt-1"
            inputMode="decimal"
            value={shopCost}
            onChange={(e) => setShopCost(e.target.value)}
            placeholder="$0.00"
          />
        </label>
      </div>
      {source === "tuner" && (
        <p className="text-xs leading-relaxed text-neutral-400">
          This win is just the notes you type. Tuner audio is never recorded or saved.
        </p>
      )}
      {error && <p className="text-xs font-semibold text-shop">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="min-h-11 flex-1 rounded-xl bg-diy px-3 text-sm font-black text-black">
          Save to My Wins
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 rounded-xl border border-white/20 px-3 text-xs font-bold text-neutral-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
