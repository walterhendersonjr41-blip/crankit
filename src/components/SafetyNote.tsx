import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";

export function SafetyNote({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "info" }) {
  const isWarn = tone === "warn";
  return (
    <div
      className={`flex gap-2 rounded-xl border px-3 py-3 text-sm leading-relaxed ${
        isWarn
          ? "border-orange-700/70 bg-orange-950/40 text-orange-100"
          : "border-white/10 bg-white/5 text-neutral-200"
      }`}
    >
      {isWarn ? (
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-garage-orange" aria-hidden />
      ) : (
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
      )}
      <div>{children}</div>
    </div>
  );
}
