/**
 * Cinematic landing — the first thing the user sees. Dark hero, a single intention-setting
 * headline, and a "Guide me" CTA that starts the voice session (which unlocks audio playback).
 * Mirrors the demo's opening beat ("EVERY DETAIL BEGINS WITH INTENTION").
 */
export function GreetingScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="greeting">
      <div className="greeting-bg" />
      <div className="greeting-scrim" />
      <div className="greeting-center">
        <div className="eyebrow eyebrow-light">2026 FORD</div>
        <h1 className="display greeting-headline">
          Every journey begins
          <br />
          with intention.
        </h1>
        <p className="greeting-sub">
          Meet Miles. Tell him about your life, and he'll build the Ford that fits it.
        </p>
        <div className="greeting-actions">
          <button className="cta" type="button" onClick={onStart}>
            Guide me
          </button>
        </div>
      </div>
    </div>
  );
}
