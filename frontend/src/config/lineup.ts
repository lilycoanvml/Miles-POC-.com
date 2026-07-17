// Lineup metadata for the vehicle picker. `id` ties to the backend Tier-1 catalog;
// `label` is what the card displays; `slot` keys into the cascade layout in styles.css.

import { LINEUP_IMG } from "./webImages";

export interface LineupItem {
  id: string;
  label: string;
  size: "sm" | "md" | "lg";
  slot: "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
}

// The six Ford trucks & vans in the prototype carousel. Slots map to the staircase positions
// in the landing cascade (a..h, top-left to bottom-right). F-150 is the deep-build hero.
export const LINEUP: LineupItem[] = [
  { id: "maverick",     label: "MAVERICK",    size: "sm", slot: "a" },
  { id: "ranger",       label: "RANGER",      size: "md", slot: "b" },
  { id: "f-150", label: "F-150",       size: "lg", slot: "c" },
  { id: "superduty",   label: "SUPER DUTY",  size: "lg", slot: "d" },
  { id: "e-transit",    label: "E-TRANSIT",   size: "md", slot: "e" },
  { id: "transit",      label: "TRANSIT",     size: "md", slot: "f" },
];

export function lineupImage(id: string): string {
  return LINEUP_IMG[id] ?? "";
}
