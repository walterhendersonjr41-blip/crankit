import { useMemo, useState } from "react";
import { Disclaimer } from "../components/Disclaimer";
import { PartLinkList } from "../components/PartLink";
import { SafetyNote } from "../components/SafetyNote";
import {
  CAN_PRESETS,
  FUEL_WARNING,
  RATIOS,
  calculateMix,
  daysRemaining,
  expirationDate,
  formatQty,
  type RatioId,
} from "../lib/fuel";
import { newId, type FuelBatch } from "../lib/storage";
import { useAppState } from "../state";

export function FuelMixPage() {
  const { batches, setBatches, isPro, openPro } = useAppState();
  const [preset, setPreset] = useState<number | "custom">(1);
  const [customGal, setCustomGal] = useState("1.25");
  const [ratio, setRatio] = useState<RatioId>("50:1");
  const [octane, setOctane] = useState("91");
  const [ethanolFree, setEthanolFree] = useState(true);
  const [stabilizer, setStabilizer] = useState(false);
  const [notes, setNotes] = useState("");
  const [mixedOn, setMixedOn] = useState(() => new Date().toISOString().slice(0, 10));

  const gallons = preset === "custom" ? Number(customGal) : preset;
  const mix = useMemo(() => calculateMix(Number.isFinite(gallons) && gallons > 0 ? gallons : 0, ratio), [gallons, ratio]);

  function logBatch() {
    if (!Number.isFinite(gallons) || gallons <= 0) return;
    const batch: FuelBatch = {
      id: newId("batch"),
      mixedOn: new Date(mixedOn).toISOString(),
      gallons,
      ratio,
      octane,
      ethanolFree,
      stabilizerAdded: stabilizer,
      notes,
    };
    setBatches([batch, ...batches]);
    setNotes("");
  }

  function removeBatch(id: string) {
    setBatches(batches.filter((b) => b.id !== id));
  }

  const expiring = batches
    .map((b) => ({ b, days: daysRemaining(b.mixedOn, b.stabilizerAdded) }))
    .filter((x) => x.days <= 7);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black">Fuel Mix</h2>
        <p className="text-sm text-neutral-400">Exact oil for the can you are filling, then log the batch so it does not go stale.</p>
      </div>

      <SafetyNote>{FUEL_WARNING}</SafetyNote>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-garage-card p-4">
        <h3 className="font-black">Gas can size</h3>
        <div className="flex flex-wrap gap-2">
          {CAN_PRESETS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setPreset(g)}
              className={`min-h-11 rounded-full px-3 text-sm font-bold ${
                preset === g ? "bg-garage-orange text-black" : "bg-white/10 text-white"
              }`}
            >
              {g} Gal
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPreset("custom")}
            className={`min-h-11 rounded-full px-3 text-sm font-bold ${
              preset === "custom" ? "bg-garage-orange text-black" : "bg-white/10 text-white"
            }`}
          >
            Custom
          </button>
        </div>
        {preset === "custom" && (
          <label className="block text-sm">
            Gallons
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={customGal}
              onChange={(e) => setCustomGal(e.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border border-white/15 bg-[#121212] px-3"
            />
          </label>
        )}

        <h3 className="font-black">Ratio</h3>
        <div className="grid grid-cols-3 gap-2">
          {RATIOS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRatio(r.id)}
              className={`min-h-14 rounded-xl px-2 text-sm font-bold leading-tight ${
                ratio === r.id ? "bg-garage-orange text-black" : "bg-white/10 text-white"
              }`}
            >
              {r.label}
              <span className="block text-[11px] font-semibold opacity-80">{r.hint}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <MixStat label="Oil (fl oz)" value={formatQty(mix.oilOz)} />
          <MixStat label="Oil (mL)" value={formatQty(mix.oilMl, 0)} />
          <MixStat label="Oil (tbsp)" value={formatQty(mix.oilTbsp)} />
        </div>
        <p className="text-xs text-neutral-500">
          Math is {formatQty(mix.ozPerGal)} fl oz of oil per gallon × {formatQty(mix.gallons)} gal.
        </p>
        <PartLinkList ids={["two-cycle-oil"]} />
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-garage-card p-4">
        <h3 className="font-black">Log new mixed-gas batch</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Mix date
            <input
              type="date"
              value={mixedOn}
              onChange={(e) => setMixedOn(e.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border border-white/15 bg-[#121212] px-3"
            />
          </label>
          <label className="block text-sm">
            Octane
            <select
              value={octane}
              onChange={(e) => setOctane(e.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border border-white/15 bg-[#121212] px-3"
            >
              <option value="89">89</option>
              <option value="91">91</option>
              <option value="93">93</option>
              <option value="other">Other / not sure</option>
            </select>
          </label>
        </div>
        <label className="flex min-h-12 items-center gap-2 text-sm">
          <input type="checkbox" checked={ethanolFree} onChange={(e) => setEthanolFree(e.target.checked)} className="h-5 w-5" />
          Ethanol-free gas
        </label>
        <label className="flex min-h-12 items-center gap-2 text-sm">
          <input type="checkbox" checked={stabilizer} onChange={(e) => setStabilizer(e.target.checked)} className="h-5 w-5" />
          Stabilizer added (90-day shelf instead of 30)
        </label>
        <label className="block text-sm">
          Notes (optional)
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border border-white/15 bg-[#121212] px-3"
            placeholder="Red can, left shelf, etc."
          />
        </label>
        {stabilizer && <PartLinkList ids={["fuel-stabilizer"]} />}
        <button
          type="button"
          onClick={logBatch}
          disabled={!Number.isFinite(gallons) || gallons <= 0}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-garage-orange px-4 text-sm font-black text-black disabled:opacity-40"
        >
          Log new mixed gas batch
        </button>
        <p className="text-xs leading-relaxed text-neutral-500">
          Unstabilized mix: 30 days. Stabilized: 90 days. Pour aging mix into a car’s gasoline tank before it gums up a small-engine carb — do not store varnish-smelling fuel.
        </p>
      </section>

      {isPro && expiring.length > 0 && (
        <SafetyNote>
          Maintenance reminder: {expiring.length} batch{expiring.length === 1 ? "" : "es"} {expiring[0].days < 0 ? "already past" : "within 7 days of"} the use-by date.
        </SafetyNote>
      )}
      {!isPro && batches.length > 0 && (
        <button type="button" onClick={() => openPro("Get fuel-batch reminders")} className="text-sm font-semibold text-orange-200">
          Pro adds automatic staleness reminders →
        </button>
      )}

      <section className="space-y-2">
        <h3 className="font-black">Logged batches</h3>
        {batches.length === 0 && <p className="text-sm text-neutral-500">No batches yet. Log one after you mix.</p>}
        {batches.map((b) => {
          const days = daysRemaining(b.mixedOn, b.stabilizerAdded);
          const exp = expirationDate(b.mixedOn, b.stabilizerAdded);
          const tone = days < 0 ? "text-shop" : days <= 7 ? "text-bolt" : "text-diy";
          return (
            <article key={b.id} className="rounded-2xl border border-white/10 bg-garage-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">
                    {b.gallons} gal · {b.ratio}
                  </p>
                  <p className="text-sm text-neutral-400">
                    Mixed {new Date(b.mixedOn).toLocaleDateString()} · {b.octane} octane
                    {b.ethanolFree ? " · ethanol-free" : " · may contain ethanol"}
                    {b.stabilizerAdded ? " · stabilized" : ""}
                  </p>
                  {b.notes && <p className="text-sm text-neutral-300">{b.notes}</p>}
                  <p className={`mt-1 text-sm font-bold ${tone}`}>
                    {days < 0
                      ? `Expired ${Math.abs(days)} day(s) ago (${exp.toLocaleDateString()})`
                      : `${days} day(s) left · use by ${exp.toLocaleDateString()}`}
                  </p>
                </div>
                <button type="button" onClick={() => removeBatch(b.id)} className="min-h-11 text-sm font-semibold text-neutral-400">
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </section>
      <Disclaimer compact />
    </div>
  );
}

function MixStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/40 px-2 py-3">
      <p className="text-2xl font-black text-garage-orange">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
    </div>
  );
}
