import { DISCLAIMER } from "../data/diagnostics";
import { privacyHref } from "../lib/paths";
import { hasAffiliateTag } from "../config/monetization";

export function Disclaimer({ compact }: { compact?: boolean }) {
  return (
    <footer className="space-y-2 px-1 pb-2 text-[11px] leading-relaxed text-neutral-500">
      {hasAffiliateTag() && (
        <p>
          Affiliate disclosure: CrankIt may earn a commission from parts links, at no extra cost to you.
        </p>
      )}
      <p>{compact ? "General guidance only. Follow the manufacturer’s manual for your exact tool." : DISCLAIMER}</p>
      <p>
        <a href={privacyHref()} className="font-semibold text-neutral-400 underline">
          Privacy
        </a>
        <span> — garage data stays on this device unless you opt in to share a fix.</span>
      </p>
    </footer>
  );
}
