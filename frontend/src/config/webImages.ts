// Image manifest for the lineup cards, reveal gallery, hero and infotainment overlay.
//
// PLACEHOLDER STATE: the previous Mazda assets (Wikimedia Commons imagery + mazdausa.com
// lineup sprites) have been removed for the Ford/Miles build. No licensed Ford press assets
// are wired yet, so these are intentionally empty — cards fall back to their text labels and
// the reveal gallery renders labelled tiles (see spec.ts / SummaryScreen). Drop Ford hero
// renders into frontend/public/lineup/ and official press imagery here before the pitch.
//
// Expected keys (one hero render per carousel vehicle):
//   maverick · ranger · f-150-lariat · super-duty · e-transit · transit
export const LINEUP_IMG: Record<string, string> = {
  // "f-150-lariat": "/lineup/f-150.png",   // ← example: add Ford renders under public/lineup/
};

// Reveal-gallery tiles for the finished F-150 build. Empty → SummaryScreen renders labelled
// fallback tiles. For a production reveal, prefer canvas snapshots of the configured 3D truck.
export const GALLERY_IMG: string[] = [];

// Greeting/landing hero image. Empty → the landing uses its CSS gradient/backdrop only.
export const HERO_IMG = "";

// Infotainment/SYNC overlay screenshot. Empty → the overlay renders its own framed placeholder.
export const CARPLAY_IMG = "";
