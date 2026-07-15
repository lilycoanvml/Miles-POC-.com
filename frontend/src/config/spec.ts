// Build-summary data for the final reveal. Resolves the chosen config ids to display names,
// plus placeholder trim/pricing/offers (swap for real Ford data before production).

import { INTERIORS, PAINTS, WHEELS } from "./materials";
import { GALLERY_IMG } from "./webImages";
import type { StageState } from "../types";

export interface BuildSummary {
  model: string;
  trim: string;
  powertrain: string;
  exterior: string;
  interior: string;
  wheel: string;
}

export function buildSummary(stage: StageState): BuildSummary {
  return {
    model: "Ford F-150",
    trim: "Lariat · SuperCrew 5.5' Box",
    powertrain: "2.7L EcoBoost V6 · 10-speed automatic · available 4x4",
    exterior: (stage.exteriorColor && PAINTS[stage.exteriorColor]?.name) || "—",
    interior: (stage.interior && INTERIORS[stage.interior]?.name) || "—",
    wheel: (stage.wheel && WHEELS[stage.wheel]?.name) || "—",
  };
}

export const STANDARD_FEATURES = [
  "325-hp 2.7L EcoBoost V6",
  "10-speed automatic · available 4x4",
  "SYNC 4 with 12-inch touchscreen",
  "Ford Co-Pilot360 driver assistance",
  "Best-in-class towing & payload · Pro Power Onboard",
];

// Placeholder pricing/offers — wire to real Ford data later.
export const PRICING = {
  totalAsBuilt: "$62,995",
  leaseEstimate: "$729 / mo",
  purchaseEstimate: "$949 / mo",
};

export const OFFERS = [
  { tag: "LEASE OFFER", title: "$599 / month", detail: "36 months · $4,499 due at signing", expires: "Dec 31, 2026" },
  { tag: "PURCHASE OFFER", title: "$1,500 Ford Credit Cash", detail: "Toward a new 2026 Ford F-150 Lariat", expires: "Dec 31, 2026" },
];

// Gallery images (sourced into /public — see webImages.ts). Currently empty for the Ford build:
// missing entries simply render fewer/labelled tiles. (For a production reveal, prefer canvas
// snapshots of the configured 3D truck.)
export interface GalleryItem {
  src: string;
  label: string;
  wide?: boolean;
}
const GALLERY_LABELS = ["Exterior", "Profile", "Rear", "Interior", "Cabin", "Detail"];

export const GALLERY: GalleryItem[] = GALLERY_IMG.map((src, i) => ({
  src,
  label: GALLERY_LABELS[i] ?? "View",
  wide: i === 1,
}));
