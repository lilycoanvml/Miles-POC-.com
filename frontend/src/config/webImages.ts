// Image manifest for the lineup cards, reveal gallery, hero and infotainment overlay.
//
// Lineup cards use the Ford renders in frontend/public/lineup/ (keys match the ids in
// config/lineup.ts). Gallery/hero/infotainment imagery is still pending licensed Ford press
// assets — those stay empty, so the reveal gallery renders labelled fallback tiles.
// Keys are the canonical Tier-1 ids (see config/lineup.ts); values are the render filenames.
export const LINEUP_IMG: Record<string, string> = {
  "maverick":     "/lineup/maverick.png",
  "ranger":       "/lineup/ranger.png",
  "f-150-lariat": "/lineup/f-150.png",
  "super-duty":   "/lineup/superduty.png",
  "e-transit":    "/lineup/e-transit.png",
  "transit":      "/lineup/transit.png",
};

// Reveal-gallery tiles for the finished F-150 build. Empty → SummaryScreen renders labelled
// fallback tiles. For a production reveal, prefer canvas snapshots of the configured 3D truck.
export const GALLERY_IMG: string[] = [];

// Greeting/landing hero image. Empty → the landing uses its CSS gradient/backdrop only.
export const HERO_IMG = "";

// Infotainment/SYNC overlay screenshot. Empty → the overlay renders its own framed placeholder.
export const CARPLAY_IMG = "";
