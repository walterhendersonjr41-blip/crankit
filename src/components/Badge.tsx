import type { BadgeKind } from "../data/diagnostics";

const COPY: Record<BadgeKind, { label: string; className: string }> = {
  diy: {
    label: "DIY Driveway Fix — No Shop Needed",
    className: "bg-diy text-black",
  },
  part: {
    label: "Easy $10–$20 Bolt-On Part",
    className: "bg-bolt text-black",
  },
  shop: {
    label: "Shop / Internal Engine Damage",
    className: "bg-shop text-white",
  },
};

export function StatusBadge({ kind, compact }: { kind: BadgeKind; compact?: boolean }) {
  const meta = COPY[kind];
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-left text-[11px] font-bold uppercase leading-tight tracking-wide ${meta.className}`}
    >
      {compact ? (kind === "diy" ? "DIY Fix" : kind === "part" ? "Bolt-On Part" : "Shop / Dead Engine") : meta.label}
    </span>
  );
}
