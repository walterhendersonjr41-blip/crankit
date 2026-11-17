import { deleteFixOutcome, downloadFixOutcomes, summarizeFixesByModel, useFixOutcomes } from "../lib/fixOutcomes";

const RAN_LABEL: Record<string, string> = { yes: "Ran", no: "Didn't run", partly: "Ran partly" };

export function FixOutcomesSection() {
  const entries = useFixOutcomes();
  const summaries = summarizeFixesByModel(entries);
  const withWins = summaries.filter((s) => s.topFixes.length > 0);

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-garage-card p-4">
      <div>
        <h3 className="font-black">What fixed it</h3>
        <p className="text-sm text-neutral-400">
          Optional driveway results after a diagnosis. Kept on this device, grouped by engine brand and model.
        </p>
      </div>

      {withWins.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-garage-orange">Most common fixes that worked</p>
          {withWins.map((summary) => (
            <div key={summary.modelKey} className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-sm font-bold text-white">{summary.displayName}</p>
              <p className="text-xs text-neutral-400">
                {summary.worked} worked / {summary.tried} logged
              </p>
              <ul className="mt-1 space-y-1 text-sm text-neutral-200">
                {summary.topFixes.slice(0, 3).map((fix) => (
                  <li key={fix.fix}>
                    {fix.fix}{" "}
                    <span className="text-xs text-neutral-400">
                      ({fix.workedCount} worked{fix.triedCount > fix.workedCount ? `, ${fix.triedCount} tried` : ""})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          No working fixes logged yet. After a diagnosis, fill in What fixed it? and tap Yes if it ran.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => downloadFixOutcomes("json")}
          className="min-h-12 rounded-xl border border-white/20 px-4 text-sm font-bold"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => downloadFixOutcomes("csv")}
          className="min-h-12 rounded-xl border border-white/20 px-4 text-sm font-bold"
        >
          Export CSV
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Downloads stay on this device until you move them. They list brand/model, symptom, test, fix, and whether it ran — no name or phone.
      </p>

      {entries.length > 0 && (
        <ul className="space-y-3">
          {entries.map((row) => (
            <li key={row.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-sm font-bold text-white">
                {[row.make, row.model].filter(Boolean).join(" ") || "Unspecified model"}
              </p>
              <p className="text-sm text-neutral-200">{row.symptom}</p>
              {row.testDone && <p className="text-xs text-neutral-400">Test: {row.testDone}</p>}
              <p className="text-sm text-neutral-100">Fix tried: {row.fix}</p>
              <p className="text-xs font-semibold text-neutral-300">{RAN_LABEL[row.ran] ?? row.ran}</p>
              <p className="mt-1 text-xs text-neutral-500">{new Date(row.at).toLocaleString()}</p>
              <button
                type="button"
                onClick={() => deleteFixOutcome(row.id)}
                className="mt-2 min-h-11 text-xs font-bold text-neutral-400"
              >
                Remove this result
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
