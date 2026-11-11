/**
 * Model idle / no-load (or official WOT / max-permissible) RPM from manufacturer
 * manuals or official spec pages only. Unverified figures are omitted, not guessed.
 * "Power at X rpm" (ISO 7293 rated-power speed) is not treated as max RPM.
 */
export type ModelSpec = {
  id: string;
  brand: "stihl" | "husqvarna" | "echo" | "poulan" | "craftsman" | "ryobi" | "homelite";
  name: string;
  aliases: string[];
  idleRpm?: number;
  idleRpmMin?: number;
  idleRpmMax?: number;
  /** Official wide-open / max-permissible engine speed, when the manual names it that way. */
  maxRpm?: number;
  maxRpmMin?: number;
  maxRpmMax?: number;
  noMixtureScrews?: boolean;
  noMixtureScrewsNote?: string;
  note?: string;
  source: { title: string; url: string };
};

const SPECS: ModelSpec[] = [
  // --- ECHO trimmers (priority) ---
  {
    id: "echo-gt-225",
    brand: "echo",
    name: "ECHO GT-225",
    aliases: ["gt-225", "gt225", "gt 225"],
    idleRpm: 3000,
    maxRpm: 7500,
    source: {
      title: "ECHO GT-225 official operator’s manual (idle 3,000 / WOT 7,500 RPM)",
      url: "https://www.echo-usa.com/getattachment/06eeedf7-d33a-432d-8ada-40560c9f94c9/v2_GT-225_29_020622_es.pdf",
    },
  },
  {
    id: "echo-srm-2620",
    brand: "echo",
    name: "ECHO SRM-2620",
    aliases: ["srm-2620", "srm2620", "srm 2620"],
    idleRpm: 3000,
    maxRpm: 10500,
    source: {
      title: "ECHO SRM-2620 official operator’s manual and support specifications (idle 3,000 / WOT 10,500 RPM)",
      url: "https://www.echo-usa.com/getattachment/088f7fb9-5967-41dc-8028-339da994ba8f/v2_SRM-2620_15_011822_e.pdf",
    },
  },
  {
    id: "echo-srm-3020t",
    brand: "echo",
    name: "ECHO SRM-3020T",
    aliases: ["srm-3020t", "srm3020t", "srm 3020t"],
    idleRpm: 2900,
    maxRpm: 10700,
    source: {
      title: "ECHO SRM-3020/T/U official operator’s manual (SRM-3020T WOT 10,700 RPM; idle 2,900)",
      url: "https://www.echo-usa.com/getattachment/f5ba5eea-a4d2-4c48-b35e-dc278066b665/filev2_",
    },
  },
  {
    id: "echo-srm-3020",
    brand: "echo",
    name: "ECHO SRM-3020",
    aliases: ["srm-3020", "srm3020", "srm 3020"],
    idleRpm: 2900,
    maxRpm: 10200,
    source: {
      title: "ECHO SRM-3020 official operator’s manual and support specifications (idle 2,900 / WOT 10,200 RPM)",
      url: "https://www.echo-usa.com/getattachment/f3c88dac-3d6d-49e3-beaf-fce6b04b90c8/SRM-3020_U09715_111219_e.pdf",
    },
  },
  {
    id: "echo-srm-225i",
    brand: "echo",
    name: "ECHO SRM-225i",
    aliases: ["srm-225i", "srm225i", "srm 225i"],
    idleRpmMin: 2500,
    idleRpmMax: 3000,
    maxRpmMin: 7600,
    maxRpmMax: 8700,
    source: {
      title: "ECHO official SRM-225i specifications (idle 2,500–3,000 / WOT 7,600–8,700 RPM)",
      url: "https://support.echo-usa.com/en/Trimmers_Brushcutters/Specifications-d069",
    },
  },
  {
    id: "echo-srm-225",
    brand: "echo",
    name: "ECHO SRM-225",
    aliases: ["srm-225", "srm225", "srm 225"],
    idleRpm: 3000,
    note: "Current ECHO specifications and recent operator manuals list idle at 3,000 RPM. Official WOT figures vary by year and serial (about 7,600–10,000 RPM), so WOT is omitted — check your manual.",
    source: {
      title: "ECHO official SRM-225 specifications (idle 3,000 RPM; WOT omitted because official manuals disagree)",
      url: "https://support.echo-usa.com/en/Trimmers_Brushcutters/Specifications-3bd",
    },
  },
  // --- ECHO saws (official manuals) ---
  {
    id: "echo-cs-310",
    brand: "echo",
    name: "ECHO CS-310",
    aliases: ["cs-310", "cs310", "cs 310"],
    idleRpm: 3200,
    maxRpm: 12500,
    source: {
      title: "ECHO CS-310 official operator’s manual (idle 3,200 / WOT 12,500 RPM)",
      url: "https://www.echo-usa.com/getattachment/1c624a98-77b1-45ef-b9f6-b640d429e7c0/filev2_",
    },
  },
  {
    id: "echo-cs-400",
    brand: "echo",
    name: "ECHO CS-400",
    aliases: ["cs-400", "cs400", "cs 400"],
    idleRpm: 2650,
    maxRpm: 12650,
    source: {
      title: "ECHO CS-400 official instruction manual (idle 2,650 / WOT 12,650 RPM)",
      url: "https://www.echo-usa.com/getattachment/07628055-6ed6-492b-9057-0bce6550dbed/CS400es1112_120913.pdf",
    },
  },
  // --- Craftsman gas trimmers ---
  // WC215 / WS215 / CMXGTAMDZ20C / CMXGTAMDZ22C official 2019 operator’s manual
  // (toolservicenet CMXGTAMDZ20C_769-23110.pdf) lists mix and plug but no idle or WOT RPM — omitted.
  {
    id: "craftsman-316-791150",
    brand: "craftsman",
    name: "Craftsman 316.791150",
    aliases: ["316.791150", "316791150", "316 791150"],
    idleRpmMin: 2800,
    idleRpmMax: 3400,
    note: "Official operator’s manual lists idle as 2,800–3,400 RPM. “Operating RPM 6,800+” is not a stated maximum, so max RPM is omitted.",
    source: {
      title: "Craftsman 2-Cycle WEEDWACKER operator’s manual, model 316.791150 (idle 2,800–3,400 RPM)",
      url: "https://c.searspartsdirect.com/doc/L1001484",
    },
  },
  // --- STIHL (official manuals); max only when listed as max permissible speed ---
  {
    id: "stihl-ms-170",
    brand: "stihl",
    name: "STIHL MS 170",
    aliases: ["ms-170", "ms170", "ms 170"],
    idleRpm: 2800,
    source: {
      title: "STIHL MS 170, 180 official instruction manual (idle 2,800 RPM; no max-permissible figure listed)",
      url: "https://ssc.stihl.com/tsa/techdoc-documents/DVS_STIHL%2FZBA%2FZBA%2F0458-207-8221-C_ZBA_04_02.pdf",
    },
  },
  {
    id: "stihl-ms-180",
    brand: "stihl",
    name: "STIHL MS 180",
    aliases: ["ms-180", "ms180", "ms 180"],
    idleRpm: 2800,
    source: {
      title: "STIHL MS 170, 180 official instruction manual (idle 2,800 RPM; no max-permissible figure listed)",
      url: "https://ssc.stihl.com/tsa/techdoc-documents/DVS_STIHL%2FZBA%2FZBA%2F0458-207-8221-C_ZBA_04_02.pdf",
    },
  },
  {
    id: "stihl-ms-250",
    brand: "stihl",
    name: "STIHL MS 250",
    aliases: ["ms-250", "ms250", "ms 250"],
    idleRpm: 2800,
    maxRpm: 14000,
    note: "Max is the official “maximum permissible speed with cutting attachment.”",
    source: {
      title: "STIHL MS 250 official operator’s manual (idle 2,800 / max permissible 14,000 RPM)",
      url: "https://cdnassets.stihlusa.com/1654177270-stihl-ms-250-owners-instruction-manual.pdf",
    },
  },
  {
    id: "stihl-ms-251",
    brand: "stihl",
    name: "STIHL MS 251",
    aliases: ["ms-251", "ms251", "ms 251"],
    idleRpm: 2800,
    maxRpm: 13000,
    note: "Max is the official “maximum permissible speed with cutting attachment.”",
    source: {
      title: "STIHL MS 251 official owner’s instruction manual (idle 2,800 / max permissible 13,000 RPM)",
      url: "https://cdnassets.stihlusa.com/1625860183-stihl-ms-251-owners-instruction-manual.pdf",
    },
  },
  {
    id: "stihl-ms-271",
    brand: "stihl",
    name: "STIHL MS 271",
    aliases: ["ms-271", "ms271", "ms 271"],
    idleRpm: 2800,
    maxRpm: 13000,
    note: "Max is the official “maximum permissible speed with cutting attachment.”",
    source: {
      title: "STIHL MS 271, 291 official owner’s instruction manual (idle 2,800 / max permissible 13,000 RPM)",
      url: "https://cdnassets.stihlusa.com/1625860478-stihl-ms-271-291-owners-instruction-manual.pdf",
    },
  },
  {
    id: "stihl-ms-291",
    brand: "stihl",
    name: "STIHL MS 291",
    aliases: ["ms-291", "ms291", "ms 291"],
    idleRpm: 2800,
    maxRpm: 13000,
    note: "Max is the official “maximum permissible speed with cutting attachment.”",
    source: {
      title: "STIHL MS 271, 291 official owner’s instruction manual (idle 2,800 / max permissible 13,000 RPM)",
      url: "https://cdnassets.stihlusa.com/1625860478-stihl-ms-271-291-owners-instruction-manual.pdf",
    },
  },
  {
    id: "stihl-ms-261-c-m",
    brand: "stihl",
    name: "STIHL MS 261 C-M",
    aliases: ["ms-261-c-m", "ms261cm", "ms 261 c-m", "ms 261 cm", "ms-261 c-m"],
    idleRpm: 2800,
    maxRpm: 14000,
    noMixtureScrews: true,
    noMixtureScrewsNote: "STIHL M-Tronic — no user mixture screws. Use the RPM reading as a check only.",
    note: "Max is the official “maximum permissible speed with cutting attachment.”",
    source: {
      title: "STIHL MS 261 C-M official instruction manual (idle 2,800 / max permissible 14,000 RPM; M-Tronic)",
      url: "https://cdnassets.stihlusa.com/1625860367-stihl-ms-261-c-m-owners-instruction-manual.pdf",
    },
  },
  // --- Husqvarna: idle only. “@ 9000 rpm” in these manuals is rated power speed, not max no-load. ---
  {
    id: "husqvarna-435",
    brand: "husqvarna",
    name: "Husqvarna 435",
    aliases: ["husqvarna 435", "husky 435"],
    idleRpm: 2900,
    source: {
      title: "Husqvarna 435, 440 official operator’s manual (idle 2,900 RPM)",
      url: "https://www.husqvarna.com/hbd/tdrdownload/v2/pub000093083/doc000234348/OM/vXOUhSDxUinpanc1nAocm5J1Seg",
    },
  },
  {
    id: "husqvarna-440",
    brand: "husqvarna",
    name: "Husqvarna 440",
    aliases: ["husqvarna 440", "husky 440"],
    idleRpm: 2900,
    source: {
      title: "Husqvarna 435, 440 official operator’s manual (idle 2,900 RPM)",
      url: "https://www.husqvarna.com/hbd/tdrdownload/v2/pub000093083/doc000234348/OM/vXOUhSDxUinpanc1nAocm5J1Seg",
    },
  },
  {
    id: "husqvarna-455-rancher",
    brand: "husqvarna",
    name: "Husqvarna 455 Rancher",
    aliases: ["455 rancher", "455e rancher", "husqvarna 455", "husky 455"],
    idleRpmMin: 2700,
    idleRpmMax: 2900,
    source: {
      title: "Husqvarna 455/460 Rancher official operator’s manual, 2026 (idle 2,700–2,900 RPM)",
      url: "https://www-static-nw.husqvarna.com/hbd/tdrdownload/v2/pub000093847/doc000246944/OM/qQO2VWZHUMLwXX0oJ06ALf_iEjQ?httproute=True",
    },
  },
  {
    id: "husqvarna-460-rancher",
    brand: "husqvarna",
    name: "Husqvarna 460 Rancher",
    aliases: ["460 rancher", "husqvarna 460", "husky 460"],
    idleRpmMin: 2700,
    idleRpmMax: 2900,
    source: {
      title: "Husqvarna 455/460 Rancher official operator’s manual, 2026 (idle 2,700–2,900 RPM)",
      url: "https://www-static-nw.husqvarna.com/hbd/tdrdownload/v2/pub000093847/doc000246944/OM/qQO2VWZHUMLwXX0oJ06ALf_iEjQ?httproute=True",
    },
  },
];

export const MODEL_SPECS: readonly ModelSpec[] = SPECS;

export function normalizeModelKey(text: string): string {
  return text.toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9]+/g, "");
}

export function findModelSpec(...parts: Array<string | undefined | null>): ModelSpec | undefined {
  const hay = normalizeModelKey(parts.filter(Boolean).join(" "));
  if (hay.length < 4) return undefined;
  const ranked = SPECS.flatMap((spec) =>
    spec.aliases.map((alias) => ({ spec, key: normalizeModelKey(alias) })),
  ).sort((a, b) => b.key.length - a.key.length);
  for (const { spec, key } of ranked) {
    if (key.length < 4) continue;
    // Only match when the user's text contains the alias. Do not let a short
    // haystack ("srm225") snap to a longer model ("srm225i").
    if (hay === key || hay.includes(key)) return spec;
  }
  return undefined;
}

export function hasOfficialIdle(spec?: ModelSpec): boolean {
  if (!spec) return false;
  return spec.idleRpm != null || (spec.idleRpmMin != null && spec.idleRpmMax != null);
}

export function hasOfficialMax(spec?: ModelSpec): boolean {
  if (!spec) return false;
  return spec.maxRpm != null || (spec.maxRpmMin != null && spec.maxRpmMax != null);
}

export function officialMaxRpm(spec?: ModelSpec): number | undefined {
  if (!spec) return undefined;
  if (spec.maxRpm != null) return spec.maxRpm;
  if (spec.maxRpmMax != null) return spec.maxRpmMax;
  return undefined;
}
