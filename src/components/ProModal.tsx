import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { FREE_GARAGE_TOOL_LIMIT } from "../config/monetization";
import { confirmPaidUnlock, proCheckoutState, proPriceLabel, stripePaymentLink, tryUnlockCode } from "../lib/pro";
import { useAppState } from "../state";

const FEATURES = [
  `Unlimited garage tools (free plan keeps ${FREE_GARAGE_TOOL_LIMIT})`,
  "Diagnostic history export and print",
  "Maintenance reminders (tune dates and aging fuel)",
  "Printable carburetor tune sheet",
];

export function ProModal() {
  const { showPro, closePro, proReason, grantPro, refreshPro } = useAppState();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  if (!showPro) return null;

  const checkout = proCheckoutState();

  function onUnlock(e: FormEvent) {
    e.preventDefault();
    const result = tryUnlockCode(code);
    if (result.ok) {
      grantPro();
      refreshPro();
      setMessage("Pro unlocked on this device.");
      setCode("");
      return;
    }
    if (result.reason === "empty-config") {
      setMessage("A shared unlock code is not set up yet. If you already paid, use “I paid — unlock this device” below.");
      return;
    }
    if (result.reason === "blank") {
      setMessage("Enter a code first, or use “I paid — unlock this device” if you already checked out.");
      return;
    }
    setMessage("That code did not match.");
  }

  function onHonorUnlock() {
    confirmPaidUnlock();
    grantPro();
    refreshPro();
    setMessage("Pro unlocked on this device.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="pro-title">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-garage-card p-4 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-garage-orange">CrankIt Pro</p>
            <h2 id="pro-title" className="text-xl font-black text-white">
              {proReason || "Unlock the full shop toolkit"}
            </h2>
          </div>
          <button type="button" onClick={closePro} className="min-h-11 min-w-11 rounded-full text-neutral-400" aria-label="Close">
            <X className="mx-auto h-6 w-6" />
          </button>
        </div>
        <p className="text-sm text-neutral-300">
          One-time unlock, {proPriceLabel()}. No subscription. All diagnostic trees, fuel math, and the shop meter stay free.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-200">
          {FEATURES.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        {checkout === "coming-soon" ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-neutral-300">
            Card checkout is <strong className="text-white">coming soon</strong>. Payments are not active yet, and nothing will be charged from this screen.
          </p>
        ) : (
          <>
            <a
              href={stripePaymentLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-garage-orange px-4 text-sm font-black uppercase tracking-wide text-black"
            >
              Unlock Pro · {proPriceLabel()}
            </a>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">
              After you pay, Stripe will confirm the purchase. Come back here and unlock this device below. The app cannot check a Stripe receipt yet.
            </p>
            <button
              type="button"
              onClick={onHonorUnlock}
              className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl border border-diy px-4 text-sm font-black text-diy"
            >
              I paid — unlock this device
            </button>
          </>
        )}

        <form onSubmit={onUnlock} className="mt-4 space-y-2">
          <label htmlFor="unlock-code" className="block text-xs font-bold uppercase tracking-wide text-neutral-400">
            Or enter an unlock code
          </label>
          <div className="flex gap-2">
            <input
              id="unlock-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="min-h-12 flex-1 rounded-xl border border-white/15 bg-[#121212] px-3 text-sm text-white"
              autoComplete="off"
              placeholder="Enter code"
            />
            <button type="submit" className="min-h-12 rounded-xl border border-white/20 px-4 text-sm font-bold text-white">
              Unlock
            </button>
          </div>
          {message && <p className="text-sm text-neutral-300">{message}</p>}
        </form>
      </div>
    </div>
  );
}
