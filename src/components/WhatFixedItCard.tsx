import { useEffect, useMemo, useState } from "react";
import {
  makeModelFromTool,
  recordFixOutcome,
  summaryForModel,
  useFixOutcomes,
  type RanResult,
} from "../lib/fixOutcomes";
import type { GarageTool } from "../lib/storage";
import { ShareFixButton } from "./ShareFixButton";

const RAN_OPTIONS: { id: RanResult; label: string }[] = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
  { id: "partly", label: "Partly" },
];

export function WhatFixedItCard({
  tool,
  toolType,
  make,
  model,
  symptom = "",
  testDone = "",
  fix = "",
  ran,
  onSaved,
  onSkip,
}: {
  tool?: GarageTool;
  toolType?: string;
  make?: string;
  model?: string;
  symptom?: string;
  testDone?: string;
  fix?: string;
  ran?: RanResult;
  onSaved?: (id: string) => void;
  onSkip?: () => void;
}) {
  const outcomes = useFixOutcomes();
  const prefill = useMemo(() => {
    const fromTool = makeModelFromTool(tool);
    return {
      make: (make ?? fromTool.make).trim(),
      model: (model ?? fromTool.model).trim(),
    };
  }, [tool, make, model]);
  const [makeText, setMakeText] = useState(prefill.make);
  const [modelText, setModelText] = useState(prefill.model);
  const [symptomText, setSymptomText] = useState(symptom);
  const [testText, setTestText] = useState(testDone);
  const [fixText, setFixText] = useState(fix);
  const [ranValue, setRanValue] = useState<RanResult | "">(ran ?? "");
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (savedId) return;
    setMakeText(prefill.make);
    setModelText(prefill.model);
  }, [prefill.make, prefill.model, savedId]);

  useEffect(() => {
    if (savedId) return;
    if (symptom) setSymptomText(symptom);
    if (testDone) setTestText(testDone);
    if (fix) setFixText(fix);
    if (ran) setRanValue(ran);
  }, [symptom, testDone, fix, ran, savedId]);

  const summary = summaryForModel(makeText, modelText, outcomes);

  function save() {
    const nextSymptom = symptomText.trim();
    const nextTest = testText.trim();
    const nextFix = fixText.trim();
    if (!nextSymptom || !nextTest || !nextFix || !ranValue) {
      setError("Add the symptom, the test you did, the fix you tried, and whether it ran.");
      return;
    }
    const entry = recordFixOutcome({
      toolId: tool?.id,
      toolType: toolType ?? tool?.toolType,
      make: makeText,
      model: modelText,
      symptom: nextSymptom,
      testDone: nextTest,
      fix: nextFix,
      ran: ranValue,
    });
    setError("");
    setSavedId(entry.id);
    onSaved?.(entry.id);
  }

  if (savedId) {
    return (
      <div className="space-y-2 rounded-2xl border border-diy/40 bg-diy/10 p-4">
        <h3 className="text-sm font-black">Saved to What fixed it</h3>
        <p className="text-xs leading-relaxed text-neutral-300">
          Kept on this device only, tied to { [makeText, modelText].filter(Boolean).join(" ") || "an unspecified model" }.
        </p>
        {summary && summary.topFixes.length > 0 && (
          <p className="text-xs leading-relaxed text-neutral-200">
            Most common fix that worked on this model: {summary.topFixes[0].fix}
            {summary.topFixes[0].workedCount > 1 ? ` (${summary.topFixes[0].workedCount} times)` : ""}.
          </p>
        )}
        <ShareFixButton
          label="Share this fix"
          input={{
            toolType: toolType ?? tool?.toolType,
            brandModel: [makeText, modelText].filter(Boolean).join(" "),
            symptom: symptomText,
            testDone: testText,
            fix: fixText,
            worked: ranValue || "yes",
          }}
        />
      </div>
    );
  }

  return (
    <form
      className="space-y-3 rounded-2xl border border-white/10 bg-garage-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div>
        <h3 className="text-sm font-black">What fixed it?</h3>
        <p className="text-xs leading-relaxed text-neutral-400">
          Optional. Stays on this phone so you can see which fixes work on this model.
        </p>
      </div>
      <label className="block text-xs font-semibold text-neutral-300">
        Engine brand
        <input className="input mt-1" value={makeText} onChange={(e) => setMakeText(e.target.value)} placeholder="ECHO" />
      </label>
      <label className="block text-xs font-semibold text-neutral-300">
        Engine model
        <input className="input mt-1" value={modelText} onChange={(e) => setModelText(e.target.value)} placeholder="GT-225" />
      </label>
      <label className="block text-xs font-semibold text-neutral-300">
        Symptom
        <input
          className="input mt-1"
          value={symptomText}
          onChange={(e) => setSymptomText(e.target.value)}
          placeholder="Won't start at all"
        />
      </label>
      <label className="block text-xs font-semibold text-neutral-300">
        Test done
        <input
          className="input mt-1"
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Checked the spark plug"
        />
      </label>
      <label className="block text-xs font-semibold text-neutral-300">
        Fix tried
        <input
          className="input mt-1"
          value={fixText}
          onChange={(e) => setFixText(e.target.value)}
          placeholder="New in-tank fuel line"
        />
      </label>
      <fieldset>
        <legend className="text-xs font-semibold text-neutral-300">Did it run?</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {RAN_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRanValue(opt.id)}
              className={`min-h-11 rounded-xl border px-2 text-sm font-bold ${
                ranValue === opt.id
                  ? "border-garage-orange bg-garage-orange text-black"
                  : "border-white/20 bg-white/5 text-neutral-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>
      {error && <p className="text-xs font-semibold text-shop">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="min-h-11 flex-1 rounded-xl bg-diy px-3 text-sm font-black text-black">
          Save this result
        </button>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="min-h-11 rounded-xl border border-white/20 px-3 text-xs font-bold text-neutral-200"
          >
            Skip for now
          </button>
        )}
      </div>
    </form>
  );
}
