import { useMemo, useState } from "react";
import { PartLink } from "../components/PartLink";
import { Disclaimer } from "../components/Disclaimer";
import { SafetyNote } from "../components/SafetyNote";
import { AcousticTuner } from "../components/AcousticTuner";
import { LIMITER_NOTE, STAMPED_LETTER_NOTE } from "../data/carbNotes";

type ScrewId = "L" | "H" | "T";
type Direction = "CW" | "CCW";

type Symptom = {
  id: string;
  label: string;
  screws: { id: ScrewId; direction: Direction; amount: string; note: string }[];
  summary: string;
};

const SYMPTOMS: Symptom[] = [
  {
    id: "bogs-trigger",
    label: "Bogs when I squeeze trigger",
    summary: "Richen the low-speed circuit a little, then snap the throttle and listen.",
    screws: [
      {
        id: "L",
        direction: "CCW",
        amount: "1/8–1/4 turn counter-clockwise",
        note: "Turn L counter-clockwise to add fuel at idle and off-idle. Confirm the L stamp first.",
      },
    ],
  },
  {
    id: "bogs-full",
    label: "Bogs at full throttle",
    summary: "Richen the high-speed circuit. A lean H screw can score the piston — sneak up on it.",
    screws: [
      {
        id: "H",
        direction: "CCW",
        amount: "1/8 turn counter-clockwise",
        note: "Hold a safe full-throttle run and turn H 1/8 turn CCW until the bog stops and you hear a slight rich burble.",
      },
    ],
  },
  {
    id: "spins-idle",
    label: "Chain/string spins at idle",
    summary: "Lower idle speed first. If it stalls, richen L a hair and re-set T/LA.",
    screws: [
      {
        id: "T",
        direction: "CCW",
        amount: "1/4 turn counter-clockwise at a time",
        note: "Turn T/LA CCW until the chain or head stops, without dying.",
      },
    ],
  },
  {
    id: "factory",
    label: "Reset to factory 1.5-turn baseline",
    summary: "A starting point only — then tune by ear, and only as far as limiter caps allow.",
    screws: [
      {
        id: "L",
        direction: "CCW",
        amount: "Seat gently, then back out 1.5 turns",
        note: "Lightly seat clockwise (do not crank hard), then back out 1.5 turns unless your manual says otherwise.",
      },
      {
        id: "H",
        direction: "CCW",
        amount: "Seat gently, then back out 1.5 turns",
        note: "Same baseline on H. Recheck the manual — some models are 1 turn, some are 1¼, some are capped.",
      },
    ],
  },
];

const HEADS = [
  { id: "flat", name: "Flathead", blurb: "A single straight slot. A regular screwdriver often works." },
  { id: "dd", name: "Double-D", blurb: "Two D-shaped lobes, like a bow-tie or dog bone." },
  { id: "pacman", name: "Pac-Man", blurb: "A round socket with one flat, like a bite taken out of a circle." },
  { id: "spline", name: "Splined 21-tooth", blurb: "A fine star/spline socket, common on newer limited carbs." },
] as const;

function dirLabel(d: Direction): string {
  return d === "CCW" ? "Counter-clockwise" : "Clockwise";
}

export function CarbTunePage() {
  const [symptomId, setSymptomId] = useState<string>(SYMPTOMS[0].id);
  const symptom = useMemo(() => SYMPTOMS.find((s) => s.id === symptomId) ?? SYMPTOMS[0], [symptomId]);
  const active = new Set(symptom.screws.map((s) => s.id));
  const primary = symptom.screws[0];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black">Carb & Tune</h2>
        <p className="text-sm text-neutral-400">Tap a symptom. The diagram shows which screw to turn, which way, and how far.</p>
      </div>

      <SafetyNote tone="info">{STAMPED_LETTER_NOTE}</SafetyNote>
      <SafetyNote>{LIMITER_NOTE}</SafetyNote>

      <AcousticTuner />

      <div className="grid gap-2">
        {SYMPTOMS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSymptomId(s.id)}
            aria-pressed={s.id === symptomId}
            className={`min-h-12 rounded-xl border px-3 py-3 text-left text-sm font-bold ${
              s.id === symptomId
                ? "border-garage-orange bg-garage-orange text-black"
                : "border-white/10 bg-garage-card text-white"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <CarbDiagram
        active={active}
        direction={primary.direction}
        amount={primary.amount}
        factory={symptom.id === "factory"}
      />

      <article className="space-y-2 rounded-2xl border border-white/10 bg-garage-card p-4">
        <h3 className="text-lg font-black">{symptom.label}</h3>
        <p className="text-sm leading-relaxed text-neutral-300">{symptom.summary}</p>
        {symptom.screws.map((sc) => (
          <p key={sc.id} className="rounded-xl bg-white/5 px-3 py-2 text-sm leading-relaxed">
            <span className="font-black text-garage-orange">{sc.id} screw</span>
            {" · "}
            {dirLabel(sc.direction)} · {sc.amount}. {sc.note}
          </p>
        ))}
      </article>

      <section className="space-y-3">
        <h3 className="text-lg font-black">Screw-head identifier</h3>
        <p className="text-sm text-neutral-400">
          Look in the screw before you grab a tool. A $9 universal kit covers the odd limiter-cap shapes.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {HEADS.map((h) => (
            <div key={h.id} className="rounded-2xl border border-white/10 bg-garage-card p-3">
              <HeadSvg kind={h.id} />
              <p className="mt-2 font-bold">{h.name}</p>
              <p className="text-xs leading-relaxed text-neutral-400">{h.blurb}</p>
            </div>
          ))}
        </div>
        <PartLink partId="carb-adjustment-tool" />
      </section>

      <p className="text-sm leading-relaxed text-neutral-400">
        After a baseline reset, set idle (T/LA) so the chain or head is stopped, then fine-tune L for a clean snap and H for a slight rich burble at full cut. Follow your manual for the exact starting turns.
      </p>
      <Disclaimer compact />
    </div>
  );
}

function CarbDiagram({
  active,
  direction,
  amount,
  factory,
}: {
  active: Set<ScrewId>;
  direction: Direction;
  amount: string;
  factory: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-garage-card p-3">
      <svg viewBox="0 0 320 240" className="h-auto w-full" role="img" aria-label="Two-stroke carburetor with L, H, and T screws">
        <rect x="0" y="0" width="320" height="240" rx="16" fill="#161616" />
        <text x="16" y="22" fill="#FF6B00" fontSize="11" fontWeight="700" letterSpacing="1">
          ENGINE SIDE
        </text>
        <text x="304" y="22" fill="#A3A3A3" fontSize="11" fontWeight="700" textAnchor="end" letterSpacing="1">
          AIR-FILTER SIDE
        </text>

        {/* carb body */}
        <rect x="70" y="50" width="180" height="110" rx="16" fill="#2a2a2a" stroke="#555" strokeWidth="2" />
        <circle cx="160" cy="105" r="28" fill="#121212" stroke="#888" strokeWidth="3" />
        <circle cx="160" cy="105" r="16" fill="#1a1a1a" stroke="#555" strokeWidth="2" />
        <text x="160" y="109" textAnchor="middle" fill="#737373" fontSize="9">
          THROAT
        </text>

        {/* inlet nipples */}
        <rect x="54" y="86" width="16" height="10" rx="2" fill="#6b6b6b" />
        <rect x="54" y="114" width="16" height="10" rx="2" fill="#6b6b6b" />

        <Screw cx={100} cy={70} id="L" active={active.has("L")} direction={direction} factory={factory} />
        <Screw cx={220} cy={70} id="H" active={active.has("H")} direction={direction} factory={factory} />
        <Screw cx={160} cy={168} id="T" active={active.has("T") || active.has("T")} direction={direction} factory={factory} label="T / LA" />

        <text x="100" y="200" textAnchor="middle" fill={active.has("L") ? "#FF6B00" : "#A3A3A3"} fontSize="11" fontWeight="700">
          L · Low
        </text>
        <text x="160" y="222" textAnchor="middle" fill={active.has("T") ? "#FF6B00" : "#A3A3A3"} fontSize="11" fontWeight="700">
          T / LA · Idle
        </text>
        <text x="220" y="200" textAnchor="middle" fill={active.has("H") ? "#FF6B00" : "#A3A3A3"} fontSize="11" fontWeight="700">
          H · High
        </text>
      </svg>
      <p className="mt-2 text-center text-sm font-bold text-garage-orange">
        {amount} {direction === "CCW" ? "↺" : "↻"}
      </p>
      <p className="mt-2 text-center text-xs leading-relaxed text-neutral-300">{STAMPED_LETTER_NOTE}</p>
    </div>
  );
}

function Screw({
  cx,
  cy,
  id,
  active,
  direction,
  factory,
  label,
}: {
  cx: number;
  cy: number;
  id: ScrewId;
  active: boolean;
  direction: Direction;
  factory: boolean;
  label?: string;
}) {
  const anim = active ? (direction === "CCW" ? "spin-ccw" : "spin-cw") : "";
  const extra = factory && active ? "pulse-ring" : "";
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {active && (
        <circle r="22" fill="none" stroke="#FF6B00" strokeWidth="2" className="pulse-ring" opacity="0.8" />
      )}
      <g className={`${anim} ${extra}`}>
        <circle r="14" fill={active ? "#FF6B00" : "#3a3a3a"} stroke={active ? "#ffd4b0" : "#777"} strokeWidth="2" />
        <rect x="-9" y="-2" width="18" height="4" rx="1" fill={active ? "#1a1a1a" : "#111"} />
      </g>
      <path
        d={direction === "CCW" ? "M 0 -24 A 24 24 0 0 0 -16 -8" : "M 0 -24 A 24 24 0 0 1 16 -8"}
        fill="none"
        stroke={active ? "#FF6B00" : "transparent"}
        strokeWidth="2"
        markerEnd="url(#arrow)"
      />
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#FF6B00" />
        </marker>
      </defs>
      <text y="4" textAnchor="middle" fontSize="9" fontWeight="800" fill={active ? "#111" : "#ddd"}>
        {label ?? id}
      </text>
    </g>
  );
}

function HeadSvg({ kind }: { kind: (typeof HEADS)[number]["id"] }) {
  return (
    <svg viewBox="0 0 64 40" className="h-16 w-full" aria-hidden>
      <rect width="64" height="40" rx="8" fill="#121212" />
      {kind === "flat" && (
        <>
          <circle cx="32" cy="20" r="12" fill="#FF6B00" />
          <rect x="20" y="18" width="24" height="4" rx="1" fill="#111" />
        </>
      )}
      {kind === "dd" && (
        <>
          <circle cx="32" cy="20" r="12" fill="#FF6B00" />
          <path d="M22 20c0-5 3-8 6-8h8c3 0 6 3 6 8s-3 8-6 8h-8c-3 0-6-3-6-8z" fill="#111" />
        </>
      )}
      {kind === "pacman" && (
        <>
          <circle cx="32" cy="20" r="12" fill="#FF6B00" />
          <path d="M32 20 L44 12 A12 12 0 1 0 44 28 Z" fill="#111" />
        </>
      )}
      {kind === "spline" && (
        <>
          <circle cx="32" cy="20" r="12" fill="#FF6B00" />
          {Array.from({ length: 21 }).map((_, i) => {
            const a = (i / 21) * Math.PI * 2;
            const x1 = 32 + Math.cos(a) * 5;
            const y1 = 20 + Math.sin(a) * 5;
            const x2 = 32 + Math.cos(a) * 9;
            const y2 = 20 + Math.sin(a) * 9;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#111" strokeWidth="1.2" />;
          })}
          <circle cx="32" cy="20" r="3" fill="#111" />
        </>
      )}
    </svg>
  );
}
