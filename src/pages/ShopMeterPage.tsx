import { useState } from "react";
import { Disclaimer } from "../components/Disclaimer";
import { SafetyNote } from "../components/SafetyNote";
import { hasLocalShopSponsor, monetization } from "../config/monetization";
import { SHOP_QUESTIONS, evaluateShop, type ShopAnswers, type YesNo, type YesNoUnchecked } from "../lib/shopMeter";

const INITIAL: ShopAnswers = {
  compression: "",
  fired: "",
  unscratched: "",
  uncracked: "",
};

export function ShopMeterPage() {
  const [answers, setAnswers] = useState<ShopAnswers>(INITIAL);
  const result = evaluateShop(answers);
  const shop = monetization.localRepairShop;

  function setKey<K extends keyof ShopAnswers>(key: K, value: ShopAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black">Shop Meter</h2>
        <p className="text-sm text-neutral-400">
          Four honest questions so you do not waste $100 at a shop — or keep buying carb kits for a scored cylinder.
        </p>
      </div>

      <div className="space-y-3">
        {SHOP_QUESTIONS.map((q, i) => (
          <fieldset key={q.key} className="space-y-2 rounded-2xl border border-white/10 bg-garage-card p-4">
            <legend className="contents">
              <p className="text-xs font-bold uppercase tracking-widest text-garage-orange">Question {i + 1}</p>
              <p className="font-bold leading-snug">{q.prompt}</p>
            </legend>
            {"safety" in q && q.safety && <SafetyNote>{q.safety}</SafetyNote>}
            <div className="grid gap-2">
              {q.options.map((opt) => {
                const on = answers[q.key] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setKey(q.key, opt.value as YesNo & YesNoUnchecked)}
                    aria-pressed={on}
                    className={`min-h-12 rounded-xl border px-3 py-3 text-left text-sm font-bold ${
                      on ? "border-garage-orange bg-garage-orange text-black" : "border-white/15 bg-white/5"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {result.kind !== "incomplete" && (
        <div
          role="status"
          className={`space-y-2 rounded-2xl border p-4 ${
            result.kind === "green"
              ? "border-diy bg-diy text-black"
              : result.kind === "red"
                ? "border-shop bg-shop text-white"
                : "border-bolt bg-bolt text-black"
          }`}
        >
          <p className="text-xl font-black leading-snug">{result.title}</p>
          <p className="text-sm font-semibold leading-relaxed">{result.body}</p>
        </div>
      )}

      {result.kind === "red" && hasLocalShopSponsor() && (
        <aside className="rounded-2xl border border-white/10 bg-garage-card p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Local repair shop</p>
          <p className="text-lg font-black">{shop.name}</p>
          {shop.blurb && <p className="text-sm leading-relaxed text-neutral-300">{shop.blurb}</p>}
          {shop.phone && <p className="text-sm font-semibold">{shop.phone}</p>}
          {shop.url && (
            <a
              href={shop.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-11 items-center font-bold text-orange-200"
            >
              Shop website
            </a>
          )}
        </aside>
      )}

      <button
        type="button"
        onClick={() => setAnswers(INITIAL)}
        className="min-h-12 w-full rounded-xl border border-white/20 font-bold"
      >
        Reset answers
      </button>
      <Disclaimer compact />
    </div>
  );
}
