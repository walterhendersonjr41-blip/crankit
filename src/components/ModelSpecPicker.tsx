import { MODEL_SPECS, officialMaxRpm, type ModelSpec } from "../data/modelSpecs";

export function specLabel(spec: ModelSpec): string {
  const cycle = spec.engineCycle === "4-stroke" ? "4-stroke" : "2-stroke";
  const idle =
    spec.idleRpm != null
      ? `idle ${spec.idleRpm.toLocaleString()}`
      : spec.idleRpmMin != null && spec.idleRpmMax != null
        ? `idle ${spec.idleRpmMin.toLocaleString()}–${spec.idleRpmMax.toLocaleString()}`
        : null;
  const max = officialMaxRpm(spec);
  const top =
    spec.maxRpmMin != null && spec.maxRpmMax != null
      ? `WOT ${spec.maxRpmMin.toLocaleString()}–${spec.maxRpmMax.toLocaleString()}`
      : max != null
        ? `WOT ${max.toLocaleString()}`
        : null;
  return [spec.name, cycle, idle, top].filter(Boolean).join(" · ");
}

/** One-tap official-model list. The parent applies a pick — nothing is auto-assigned. */
export function ModelSpecPicker({
  value,
  onPick,
  specs = MODEL_SPECS,
  allowClear = true,
  emptyLabel = "Not listed — I’ll type it",
  label = "Official model (optional)",
}: {
  value?: string;
  onPick: (spec: ModelSpec | undefined) => void;
  specs?: readonly ModelSpec[];
  allowClear?: boolean;
  emptyLabel?: string;
  label?: string;
}) {
  return (
    <label className="block text-sm font-semibold text-neutral-300">
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          onPick(id ? specs.find((s) => s.id === id) : undefined);
        }}
        className="input mt-1"
      >
        {allowClear && <option value="">{emptyLabel}</option>}
        {specs.map((s) => (
          <option key={s.id} value={s.id}>
            {specLabel(s)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EngineShortlist({
  specs,
  onPick,
}: {
  specs: readonly ModelSpec[];
  onPick: (spec: ModelSpec) => void;
}) {
  if (specs.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Tap to pick — nothing is assigned until you tap</p>
      <div className="flex flex-wrap gap-2">
        {specs.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s)}
            className="min-h-11 rounded-xl border border-white/20 bg-white/5 px-3 text-left text-xs font-bold"
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
