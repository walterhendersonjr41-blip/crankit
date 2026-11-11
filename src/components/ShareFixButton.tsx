import { useState } from "react";
import { buildSharedFix, submitSharedFix, type SharedFixInput } from "../lib/shareFix";

export const SHARE_CONSENT =
  "This opens a prefilled email with only an anonymous symptom, fix, tool type, and brand/model — no name or device ID. Your email app’s sender address will be visible to us.";

export function ShareFixButton({ input, label = "Share this fix with CrankIt" }: { input: SharedFixInput; label?: string }) {
  const [phase, setPhase] = useState<"idle" | "confirm" | "sending" | "sent" | "error">("idle");
  const [honeypot, setHoneypot] = useState("");

  async function send() {
    setPhase("sending");
    try {
      const href = await submitSharedFix(buildSharedFix(input), honeypot);
      if (!href && honeypot.trim()) {
        setPhase("idle");
        return;
      }
      setPhase("sent");
    } catch {
      setPhase("error");
    }
  }

  if (phase === "sent") {
    return (
      <p className="text-xs font-semibold text-diy">
        Your email app should open with the anonymous fields. Send it if you still want to share, or cancel there.
      </p>
    );
  }

  if (phase === "confirm" || phase === "sending" || phase === "error") {
    return (
      <div className="space-y-2 rounded-xl border border-white/15 bg-black/30 p-3">
        <p className="text-xs leading-relaxed text-neutral-300">{SHARE_CONSENT}</p>
        <label className="hidden">
          Don’t fill this in
          <input value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
        </label>
        {phase === "error" && <p className="text-xs text-shop">Couldn’t open your email app. You can copy the fields and try again.</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={phase === "sending"}
            onClick={() => void send()}
            className="min-h-11 rounded-xl bg-garage-orange px-3 text-xs font-black text-black disabled:opacity-50"
          >
            {phase === "sending" ? "Opening…" : "Confirm share"}
          </button>
          <button
            type="button"
            disabled={phase === "sending"}
            onClick={() => setPhase("idle")}
            className="min-h-11 rounded-xl border border-white/20 px-3 text-xs font-bold text-neutral-200"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPhase("confirm")}
      className="min-h-11 rounded-xl border border-white/20 px-3 text-xs font-bold text-orange-200"
    >
      {label}
    </button>
  );
}
