import { Crown } from "lucide-react";
import { useAppState } from "../state";

export function Header() {
  const { isPro, openPro } = useAppState();
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0c0c0c]/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-garage-orange">CrankIt</p>
          <h1 className="truncate text-lg font-black leading-tight text-white">Real 2-Stroke Mechanic</h1>
        </div>
        {isPro ? (
          <span className="inline-flex min-h-10 items-center gap-1 rounded-full bg-garage-orange px-3 text-xs font-black uppercase tracking-wide text-black">
            <Crown className="h-3.5 w-3.5" aria-hidden />
            Pro
          </span>
        ) : (
          <button
            type="button"
            onClick={() => openPro("Unlock CrankIt Pro")}
            className="inline-flex min-h-10 items-center rounded-full border border-garage-orange px-3 text-xs font-black uppercase tracking-wide text-garage-orange"
          >
            Get Pro
          </button>
        )}
      </div>
    </header>
  );
}
