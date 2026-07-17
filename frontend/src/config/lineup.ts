// Lineup metadata for the browse carousel. `id` is the canonical Tier-1 catalog id (matches
// app/kb.py lineup() and the focus_lineup_model tool); `label` is what the carousel displays.

import { LINEUP_IMG } from "./webImages";

export interface LineupItem {
  id: string;
  label: string;
}

// The six Ford trucks & vans, in carousel order. The F-150 Lariat is the deep-build hero and
// the vehicle the morph resolves into, so it sits at the centre of the run.
export const LINEUP: LineupItem[] = [
  { id: "maverick",     label: "MAVERICK" },
  { id: "ranger",       label: "RANGER" },
  { id: "f-150-lariat", label: "F-150" },
  { id: "super-duty",   label: "SUPER DUTY" },
  { id: "e-transit",    label: "E-TRANSIT" },
  { id: "transit",      label: "TRANSIT" },
];

// The vehicle the carousel centres on by default (and the one the orb morphs into).
export const HERO_ID = "f-150-lariat";

export function lineupImage(id: string): string {
  return LINEUP_IMG[id] ?? "";
}

export function lineupIndex(id: string | null): number {
  if (!id) return -1;
  return LINEUP.findIndex((it) => it.id === id);
}
