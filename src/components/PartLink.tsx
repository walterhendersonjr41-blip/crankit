import { ExternalLink } from "lucide-react";
import { PARTS, hasAffiliateTag, partUrl, type PartId } from "../config/monetization";

export function PartLink({ partId }: { partId: PartId }) {
  const part = PARTS[partId];
  const href = partUrl(partId);
  return (
    <a
      href={href}
      target="_blank"
      rel={hasAffiliateTag() ? "nofollow sponsored noopener noreferrer" : "noopener noreferrer"}
      className="inline-flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-garage-orange/70 bg-garage-orange/10 px-3 py-2 text-left text-sm font-semibold text-orange-100 hover:bg-garage-orange/20"
    >
      <span>
        Get this part: {part.label}
        <span className="mt-0.5 block text-xs font-normal text-neutral-400">Typical {part.typicalPrice} · Amazon search</span>
      </span>
      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
    </a>
  );
}

export function PartLinkList({ ids }: { ids?: PartId[] }) {
  if (!ids?.length) return null;
  return (
    <div className="space-y-2">
      {ids.map((id) => (
        <PartLink key={id} partId={id} />
      ))}
    </div>
  );
}
