/**
 * Monetization switches for CrankIt.
 *
 * Leave these empty to ship a free, fully working app.
 * Fill them in later to turn on affiliate links, Pro checkout,
 * an unlock code, or a local-shop sponsor slot.
 *
 * Do not put personal names, phone numbers, addresses, or dates
 * of birth in this file or anywhere else in the app.
 */
export type LocalShopSponsor = {
  name: string;
  phone: string;
  url: string;
  blurb: string;
};

export type MonetizationConfig = {
  /** Amazon Associates tag, e.g. "yourtag-20". Empty = plain Amazon search, no tag. */
  amazonAssociateTag: string;
  /** Stripe Payment Link URL for the $4.99 one-time Pro unlock. Empty = "Coming soon". */
  stripePaymentLink: string;
  /** Human-readable Pro price shown in the paywall. */
  proPriceLabel: string;
  /**
   * Optional one-time unlock code. When set, a user who enters this
   * exact code is granted Pro on this device (stored in localStorage).
   * Leave empty so no code works until you choose one.
   */
  proUnlockCode: string;
  /**
   * Shown only on a Shop Meter RED result when `name` is non-empty.
   * Hidden completely when name is empty.
   */
  localRepairShop: LocalShopSponsor;
};

export const monetization: MonetizationConfig = {
  amazonAssociateTag: "",
  stripePaymentLink: "https://buy.stripe.com/14A6oH1tibkAcKP5bE1Fe00",
  proPriceLabel: "$4.99 one-time",
  proUnlockCode: "",
  localRepairShop: {
    name: "",
    phone: "",
    url: "",
    blurb: "",
  },
};

export const FREE_GARAGE_TOOL_LIMIT = 2;

export type PartId =
  | "spark-plug"
  | "spark-plug-wire-boot"
  | "carb-diaphragm-kit"
  | "ignition-coil"
  | "spark-arrestor-screen"
  | "in-tank-fuel-filter"
  | "tygon-fuel-line"
  | "tank-vent"
  | "primer-bulb"
  | "carb-cleaner"
  | "clutch-spring"
  | "carb-adjustment-tool"
  | "two-cycle-oil"
  | "fuel-stabilizer";

export type PartDef = {
  id: PartId;
  label: string;
  searchQuery: string;
  typicalPrice: string;
};

export const PARTS: Record<PartId, PartDef> = {
  "spark-plug": {
    id: "spark-plug",
    label: "Spark plug",
    searchQuery: "small engine 2 stroke chainsaw spark plug",
    typicalPrice: "$4",
  },
  "spark-plug-wire-boot": {
    id: "spark-plug-wire-boot",
    label: "Spark plug wire & boot",
    searchQuery: "chainsaw spark plug boot wire",
    typicalPrice: "$0–$4",
  },
  "carb-diaphragm-kit": {
    id: "carb-diaphragm-kit",
    label: "Carburetor diaphragm & gasket kit",
    searchQuery: "2 stroke carburetor diaphragm gasket kit",
    typicalPrice: "$6",
  },
  "ignition-coil": {
    id: "ignition-coil",
    label: "Ignition coil",
    searchQuery: "2 stroke chainsaw ignition coil",
    typicalPrice: "$18",
  },
  "spark-arrestor-screen": {
    id: "spark-arrestor-screen",
    label: "Muffler spark arrestor screen",
    searchQuery: "chainsaw muffler spark arrestor screen",
    typicalPrice: "$5–$10",
  },
  "in-tank-fuel-filter": {
    id: "in-tank-fuel-filter",
    label: "In-tank felt fuel filter",
    searchQuery: "2 stroke in tank felt fuel filter",
    typicalPrice: "$3",
  },
  "tygon-fuel-line": {
    id: "tygon-fuel-line",
    label: "Tygon fuel line",
    searchQuery: "Tygon small engine fuel line 2 stroke",
    typicalPrice: "$5",
  },
  "tank-vent": {
    id: "tank-vent",
    label: "Fuel tank vent",
    searchQuery: "chainsaw fuel tank vent valve",
    typicalPrice: "$8",
  },
  "primer-bulb": {
    id: "primer-bulb",
    label: "Primer bulb",
    searchQuery: "2 stroke primer bulb replacement",
    typicalPrice: "$4",
  },
  "carb-cleaner": {
    id: "carb-cleaner",
    label: "Carburetor cleaner spray",
    searchQuery: "carburetor cleaner spray small engine",
    typicalPrice: "$6",
  },
  "clutch-spring": {
    id: "clutch-spring",
    label: "Clutch spring",
    searchQuery: "chainsaw clutch spring replacement",
    typicalPrice: "$8–$15",
  },
  "carb-adjustment-tool": {
    id: "carb-adjustment-tool",
    label: "Universal carb adjustment tool kit",
    searchQuery: "universal carburetor adjustment tool kit splined pacman double D",
    typicalPrice: "$9",
  },
  "two-cycle-oil": {
    id: "two-cycle-oil",
    label: "JASO FD 2-cycle oil",
    searchQuery: "JASO FD ISO-L-EGD air cooled 2 cycle oil",
    typicalPrice: "$10–$15",
  },
  "fuel-stabilizer": {
    id: "fuel-stabilizer",
    label: "Fuel stabilizer",
    searchQuery: "fuel stabilizer small engine ethanol treatment",
    typicalPrice: "$8",
  },
};

export function amazonSearchUrl(query: string, tag = monetization.amazonAssociateTag): string {
  const url = new URL("https://www.amazon.com/s");
  url.searchParams.set("k", query);
  const trimmed = tag.trim();
  if (trimmed) url.searchParams.set("tag", trimmed);
  return url.toString();
}

export function partUrl(partId: PartId): string {
  return amazonSearchUrl(PARTS[partId].searchQuery);
}

export function hasAffiliateTag(): boolean {
  return monetization.amazonAssociateTag.trim().length > 0;
}

export function hasStripeLink(): boolean {
  return monetization.stripePaymentLink.trim().length > 0;
}

export function hasLocalShopSponsor(): boolean {
  return monetization.localRepairShop.name.trim().length > 0;
}

export function configuredUnlockCode(): string {
  return monetization.proUnlockCode.trim();
}
