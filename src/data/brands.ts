/**
 * Built-in brand notes sourced from manufacturer manuals / official pages.
 * Facts that could not be verified officially are omitted (not guessed).
 * Always tell the user to check the manual for their exact model.
 */
export type BrandId = "stihl" | "husqvarna" | "echo" | "poulan" | "craftsman" | "ryobi" | "homelite" | "honda" | "briggs" | "kohler" | "predator";

export type SourcedFact = {
  value: string;
  note: string;
};

export type BrandSource = {
  title: string;
  url: string;
};

export type BrandProfile = {
  id: BrandId;
  name: string;
  aliases: string[];
  mixRatio?: SourcedFact;
  sparkPlug?: SourcedFact;
  carbMaker?: SourcedFact;
  screwHeads?: SourcedFact;
  sources: BrandSource[];
  checkManual: string;
};

const CHECK = "These are typical published figures, not a guarantee for every model and year. Check the manufacturer’s manual for your exact tool.";

export const BRANDS: BrandProfile[] = [
  {
    id: "stihl",
    name: "STIHL",
    aliases: ["stihl", "stil", "stehl"],
    mixRatio: {
      value: "50:1",
      note: "Official STIHL operator manuals (including FS 40/50, BG 50, and BR 350/430) specify a 50:1 mix with STIHL two-stroke oil or equivalent air-cooled 2-cycle oil. STIHL also sells pre-mix MotoMix.",
    },
    sparkPlug: {
      value: "Often NGK BPMR7A or Bosch WSR 6 F on many handhelds",
      note: "BG 50 and BR 350/430 manuals list NGK BPMR 7 A and Bosch WSR 6 F. Some other STIHL models differ (for example the BR 500 manual lists NGK CMR6H / Bosch USR 4AC). Confirm the plug in your manual.",
    },
    screwHeads: {
      value: "Varies: plastic limiter caps (user-adjustable) or octagonal-profile screws (dealer adjustment). Some M-Tronic models have no mixture screws.",
      note: "The official BG 50 manual: if the adjusting screws have an octagonal profile, have a STIHL dealer adjust the carb; if they have plastic caps, the user may continue. Do not assume your saw has user mixture screws.",
    },
    sources: [
      { title: "STIHL FS 40, FS 50 operator's manual (50:1 mix)", url: "https://cdnassets.stihlusa.com/1654020003-stihl-fs-40-fs-50-owners-instruction-manual.pdf" },
      { title: "STIHL BG 50 instruction manual (mix, plugs, screw profile)", url: "https://ssc.stihl.com/tsa/techdoc-documents/DVS_STIHL%2FZBA%2FZBA%2F0458-425-0121-E_ZBA_03_01.pdf" },
      { title: "STIHL BR 350, 430 instruction manual (50:1, BPMR 7 A / WSR 6 F)", url: "https://ssc.stihl.com/tsa/techdoc-documents/DVS_STIHL%2FZBA%2FZBA%2F0458-456-8621-F_ZBA_02_01.pdf" },
    ],
    checkManual: CHECK,
  },
  {
    id: "husqvarna",
    name: "Husqvarna",
    aliases: ["husqvarna", "husky", "husqvana"],
    mixRatio: {
      value: "50:1",
      note: "Husqvarna’s official US support page and current chainsaw operator manuals (including 435/440 and 455/460 Rancher) specify a 50:1 (2%) mix. A Husqvarna US mixing guide also describes 50:1 as a general guide for products up to and including 75 cc. Check your manual, especially for larger or older models.",
    },
    sparkPlug: {
      value: "Often NGK BPMR7A, Champion RCJ7Y, or Husqvarna HQT-1R",
      note: "The official 435/440 operator manual lists NGK BPMR 7A / Champion RCJ 7Y / Husqvarna HQT-1R. Confirm the plug in your model’s technical data table.",
    },
    screwHeads: {
      value: "L, H, and T (idle) screws are described in official manuals; some models limit mixture-screw travel (for example ½ turn).",
      note: "The 455/460 Rancher operator manual (2026) states emissions laws limit adjuster-screw travel to a maximum of ½ turn. Do not force past a limiter. Head shape is not specified in those manuals, so match the screw on your carb and use the Carb & Tune identifier.",
    },
    sources: [
      { title: "Husqvarna US: how to mix two-stroke oil and fuel (50:1)", url: "https://us-support.husqvarna.com/en/petrol-chainsaw/KA-01557" },
      { title: "Husqvarna 435, 440 operator's manual (mix, plug, idle screw T)", url: "https://www.husqvarna.com/hbd/tdrdownload/v2/pub000093083/doc000234348/OM/vXOUhSDxUinpanc1nAocm5J1Seg" },
      { title: "Husqvarna 455/460 Rancher operator's manual, 2026 (50:1, ½-turn limiter)", url: "https://www-static-nw.husqvarna.com/hbd/tdrdownload/v2/pub000093847/doc000246944/OM/qQO2VWZHUMLwXX0oJ06ALf_iEjQ?httproute=True" },
    ],
    checkManual: CHECK,
  },
  {
    id: "echo",
    name: "ECHO",
    aliases: ["echo", "echo-usa"],
    mixRatio: {
      value: "50:1 on current 2-stroke engines",
      note: "ECHO’s official fuel/oil FAQ and current product specification pages specify a 50:1 mix with ISO-L-EGD / JASO M345-FD oil and mid-grade 89–93 octane gasoline. The same FAQ notes that older ECHO engines were sometimes specified at 32:1 or 16:1; ECHO says those can now use 50:1 with modern oil, but still check the operator’s manual for a vintage tool.",
    },
    sparkPlug: {
      value: "Often NGK BPMR7A; some models differ",
      note: "Official ECHO chainsaw specification pages list NGK BPMR7A (0.65 mm / 0.026 in gap). Some official trimmer pages differ (for example SRM-410U lists NGK BPM7A; GT-225SF lists NGK BPM8Y). Check your manual.",
    },
    carbMaker: {
      value: "Often a Walbro diaphragm carburetor with a primer/purge bulb on documented models",
      note: "Official ECHO specification pages list “Walbro w/purge pump” on models such as the SRM-410U. That is not a promise for every ECHO ever made — read the name on your carb body.",
    },
    sources: [
      { title: "ECHO official FAQ: fuel/oil requirements (50:1)", url: "http://echo-usa.custhelp.com/app/answers/detail/a_id/18/~/fuel%2Foil-ratio" },
      { title: "ECHO official chainsaw specifications (50:1, NGK BPMR7A)", url: "https://support.echo-usa.com/en/Chainsaws/Specifications-2212" },
      { title: "ECHO SRM-410U official specifications (Walbro w/purge, NGK BPM7A, 50:1)", url: "https://support.echo-usa.com/en/Trimmers_Brushcutters/Specifications-c4cf" },
    ],
    checkManual: CHECK,
  },
  {
    id: "poulan",
    name: "Poulan / Poulan Pro",
    aliases: ["poulan", "poulan pro", "poulanpro", "weed eater", "weedeater"],
    mixRatio: {
      value: "Check your manual — official Poulan manuals use either 50:1 or 40:1",
      note: "The official 2018 Poulan PL3314/PL3816 chain-saw manual specifies 50:1 (2.6 oz full-synthetic 2-cycle oil per gallon). The official 2011 Poulan PRO PP2822 manual specifies 40:1 (3.2 oz per gallon). Do not guess. Use the ratio printed in your model’s manual.",
    },
    sparkPlug: {
      value: "Varies by model — check your manual",
      note: "The official PP2822 manual specifies Champion RCJ-6Y (0.025 in / 0.6 mm gap). The official PL3314/PL3816 manual specifies a Brisk HQT-1 (0.025 in / 0.6 mm gap). These are not interchangeable assumptions.",
    },
    sources: [
      { title: "Poulan PL3314, PL3816 official operator's manual, 2018 (50:1, Brisk HQT-1)", url: "https://admin.poulanpro.com/wp-content/uploads/2023/10/doc000114928.pdf" },
      { title: "Poulan PRO PP2822 official instruction manual, 2011 (40:1, Champion RCJ-6Y)", url: "http://pdf.lowes.com/useandcareguides/024761017657_use.pdf" },
    ],
    checkManual: CHECK,
  },
  {
    id: "craftsman",
    name: "Craftsman",
    aliases: ["craftsman"],
    mixRatio: {
      value: "Check your manual — official Craftsman 2-cycle manuals are not all the same ratio",
      note: "The official Craftsman WC215 / CMXGTAMDZ20C operator’s manual specifies a 40:1 mix (3.2 fl oz / 95 ml of 2-cycle oil per US gallon). Do not assume 50:1 on a Craftsman. Use the ratio in your model’s manual.",
    },
    sparkPlug: {
      value: "Champion RDJ7J or equivalent is specified on official CMXGTAMDZ20C-series manuals",
      note: "The official CMXGTAMDZ20C / WC215 manual lists Champion RDJ7J (or equivalent), gap 0.025 in (0.635 mm). Other Craftsman models may differ. Check your manual.",
    },
    sources: [
      { title: "Craftsman WC215 / CMXGTAMDZ20C official operator's manual (40:1, Champion RDJ7J)", url: "https://www.toolservicenet.com/i/CRAFTSMAN/GLOBALBOM/QU/CMXGTAMDZ20C/2020/Instruction_Manual/EN/CMXGTAMDZ20C_769-23110.pdf" },
    ],
    checkManual: CHECK,
  },
  {
    id: "ryobi",
    name: "Ryobi",
    aliases: ["ryobi"],
    mixRatio: {
      value: "50:1 on documented 2-cycle trimmer manuals",
      note: "Multiple official-style Ryobi 2-cycle 25 cc string-trimmer operator manuals specify a 50:1 gasoline/oil ratio (2.6 fl oz / 77 ml oil per US gallon). Always confirm in your model’s manual.",
    },
    sparkPlug: {
      value: "Champion RDJ7J or equivalent appears in several US 25 cc trimmer manuals; some other Ryobi 2-cycle manuals list Champion RCJ-6Y",
      note: "Because official Ryobi manuals do not all list the same plug, check the specifications page in your manual before you buy a replacement. A common listed gap is 0.025 in (0.635 mm).",
    },
    sources: [
      { title: "Ryobi 2-cycle 25 cc string trimmer operator's manual (50:1, Champion RDJ7J)", url: "https://media.tractorsupply.com/is/content/TractorSupplyCompany/tsc/product/1/60/17/14/1601714_Man1.pdf" },
    ],
    checkManual: CHECK,
  },
  {
    id: "homelite",
    name: "Homelite",
    aliases: ["homelite"],
    mixRatio: {
      value: "50:1 on documented 26 cc trimmer manuals",
      note: "The Homelite 26CS UT32600 / 26SS UT32650 operator information specifies a 50:1 gasoline-to-2-cycle-oil mix. Confirm in your model’s manual; older Homelite saws may differ.",
    },
    sparkPlug: {
      value: "Champion RCJ6Y is listed for the UT32600 / UT32650 series",
      note: "Confirm the plug and gap in your model’s manual before replacing it.",
    },
    sources: [
      { title: "Homelite official owner's manuals library (UT32600 / UT32650)", url: "https://manuals.homelite.com/documents/1729" },
      { title: "Homelite UT32600 / UT32650 operator manual pack", url: "https://manuals.homelite.com/system/files/4509/original/UT32600_UT32650_056_r.pdf?2017=" },
    ],
    checkManual: CHECK,
  },

  {
    id: "honda",
    name: "Honda",
    aliases: ["honda"],
    sources: [{ title: "Honda Engines official owner’s manuals", url: "https://engines.honda.com/support-and-service/owners-manuals" }],
    checkManual: CHECK,
  },
  {
    id: "briggs",
    name: "Briggs & Stratton",
    aliases: ["briggs", "briggs & stratton", "briggs and stratton", "b&s"],
    sources: [{ title: "Briggs & Stratton official operator manuals", url: "https://www.briggsandstratton.com/na/en_us/support/manuals.html" }],
    checkManual: CHECK,
  },
  {
    id: "kohler",
    name: "Kohler",
    aliases: ["kohler", "kohler courage", "kohler xt"],
    sources: [{ title: "Kohler Engines official literature", url: "https://kohlerengines.com/brochures-literature" }],
    checkManual: CHECK,
  },
  {
    id: "predator",
    name: "Predator",
    aliases: ["predator", "harbor freight predator"],
    sources: [{ title: "Harbor Freight official Predator 212 owner’s manual", url: "https://manuals.harborfreight.com/manuals/60000-60999/60363-792363603638.pdf" }],
    checkManual: CHECK,
  },
];

export function brandById(id: string): BrandProfile | undefined {
  return BRANDS.find((b) => b.id === id);
}

export function detectBrand(text: string): BrandProfile | undefined {
  const hay = text.toLowerCase();
  // Longer aliases first so "poulan pro" wins over a short token.
  const ranked = BRANDS.flatMap((b) => b.aliases.map((alias) => ({ b, alias }))).sort(
    (a, b) => b.alias.length - a.alias.length,
  );
  for (const { b, alias } of ranked) {
    const re = new RegExp(`(?:^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`, "i");
    if (re.test(hay)) return b;
  }
  return undefined;
}

export function formatBrandNote(brand: BrandProfile): string {
  const bits = [`For a ${brand.name} (typical published figures — ${brand.checkManual})`];
  if (brand.mixRatio) bits.push(`Mix: ${brand.mixRatio.value}. ${brand.mixRatio.note}`);
  if (brand.sparkPlug) bits.push(`Spark plug: ${brand.sparkPlug.value}. ${brand.sparkPlug.note}`);
  if (brand.carbMaker) bits.push(`Carb: ${brand.carbMaker.value}. ${brand.carbMaker.note}`);
  if (brand.screwHeads) bits.push(`Adjustment screws: ${brand.screwHeads.value}. ${brand.screwHeads.note}`);
  return bits.join("\n");
}

export function brandForTool(tool?: { brand?: string; brandModel?: string; name?: string }): BrandProfile | undefined {
  if (!tool) return undefined;
  if (tool.brand) return brandById(tool.brand) ?? detectBrand(tool.brand);
  return detectBrand([tool.name ?? "", tool.brandModel ?? ""].join(" "));
}
