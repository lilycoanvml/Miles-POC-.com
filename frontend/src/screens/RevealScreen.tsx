import { useEffect, useMemo, useRef, useState } from "react";
import { HERO_ID, LINEUP, lineupImage, lineupIndex } from "../config/lineup";

/**
 * The reveal stage — one continuous cinematic beat on a bright studio floor, matching the demo:
 *
 *   listening  → a flowing, audio-reactive light ribbon the user talks to
 *   morphing   → the ribbon resolves into the F-150: wireframe outline → mesh → glowing ghost → solid
 *   carousel   → the solid truck lands as the hero of a clean, scrollable lineup carousel
 *
 * The morph is driven by CSS keyframes (see .reveal[data-phase="morphing"] in styles.css); this
 * component only sequences the phases and positions the cars. Voice ("show me the Ranger") scrolls
 * the carousel via `focusedId`; the user can also click a neighbour or use the arrows.
 */

type Phase = "listening" | "morphing" | "carousel";

const LEN = LINEUP.length;
const HERO_INDEX = Math.max(0, lineupIndex(HERO_ID));
// Orb hue by persona (matches content/personas/<id>/persona.json orbSignal). Default = light blue.
const PERSONA_TINT: Record<string, [number, number, number]> = {
  build: [31, 95, 166],
  thrill: [194, 24, 7],
  adventure: [46, 125, 50],
};
const DEFAULT_TINT: [number, number, number] = [150, 195, 255];
const MORPH_MS = 3200; // keep in sync with the morph keyframe durations in styles.css
const SPIN_MS = 1500; // auto-advance interval while spinning
// The carousel renders three concatenated copies of the lineup so it can loop endlessly; the
// centre always lives in the middle copy, and we silently snap back after crossing a boundary.
const COPIES = 3;
const START = LEN + HERO_INDEX; // absolute index of the F-150 in the middle copy

interface Props {
  speaking: boolean;
  revealStarted: boolean; // lineup has been shown → play the morph
  focusedId: string | null; // vehicle Miles asked to centre (Tier-1 id)
  spinning: boolean; // Miles asked to auto-spin through the lineup
  persona?: string | null; // locked persona (miles3) → tints the orb
}

export function RevealScreen({ speaking, revealStarted, focusedId, spinning, persona }: Props) {
  const [phase, setPhase] = useState<Phase>(revealStarted ? "carousel" : "listening");
  const [index, setIndex] = useState(START); // absolute index into the tripled item list
  const [animate, setAnimate] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;
  // Live tint so the running animation picks up a persona change without restarting.
  const tintRef = useRef<[number, number, number]>(DEFAULT_TINT);
  tintRef.current = (persona && PERSONA_TINT[persona]) || DEFAULT_TINT;

  const heroImg = useMemo(() => lineupImage(HERO_ID), []);

  // --- flowing light ribbon (drawn continuously; CSS fades the canvas out once we leave "listening")
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let t = 0;
    let intensity = 0.5; // eased speaking level (idles with a gentle drift)

    // centreline of the flowing ribbon at horizontal position p∈[0,1]
    const yAt = (p: number, cy: number, amp: number, env: number) =>
      cy +
      Math.sin(p * 6.5 + t * 0.9) * amp * env +
      Math.sin(p * 2.3 - t * 0.5) * amp * 0.5 * env;

    const draw = () => {
      t += 0.016;
      const target = speakingRef.current ? 1 : 0.5;
      intensity += (target - intensity) * 0.06;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h * 0.46;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      const span = w * 0.72;
      const amp = h * (0.06 + 0.05 * intensity);
      const [tr, tg, tb] = tintRef.current;

      // soft halo behind the ribbon
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, span * 0.7);
      halo.addColorStop(0, `rgba(${tr},${tg},${tb},${0.14 + 0.16 * intensity})`);
      halo.addColorStop(0.55, `rgba(${tr},${tg},${tb},0.06)`);
      halo.addColorStop(1, `rgba(${tr},${tg},${tb},0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      // flowing volume: many overlapping soft blobs along the centreline build a bright light mass
      const N = 48;
      const core = 0.16 + 0.18 * intensity;
      for (let i = 0; i <= N; i++) {
        const p = i / N;
        const env = Math.pow(Math.sin(Math.PI * p), 0.7); // taper the ends to nothing
        const x = cx - span / 2 + span * p;
        const y = yAt(p, cy, amp, env);
        const r = h * 0.11 * env * (0.7 + 0.3 * Math.sin(p * 10 + t));
        if (r <= 0) continue;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${core})`);
        g.addColorStop(0.5, `rgba(${(tr + 510) / 3},${(tg + 510) / 3},${(tb + 510) / 3},${core * 0.5})`);
        g.addColorStop(1, `rgba(${tr},${tg},${tb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // bright filaments on top for the wispy "living light" detail
      const strands = 5;
      ctx.lineCap = "round";
      for (let k = 0; k < strands; k++) {
        const ph = k * 1.1;
        const speed = 0.7 + k * 0.2;
        const yoff = (k - strands / 2) * (h * 0.004);
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const p = i / 120;
          const env = Math.sin(Math.PI * p);
          const x = cx - span / 2 + span * p;
          const y =
            cy +
            yoff +
            Math.sin(p * 8 + t * speed + ph) * amp * env +
            Math.sin(p * 3 + t * speed * 0.5) * amp * 0.4 * env;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineWidth = dpr * (0.8 + k * 0.3);
        ctx.shadowColor = `rgba(${tr},${tg},${tb},0.9)`;
        ctx.shadowBlur = dpr * 9;
        ctx.strokeStyle = `rgba(255,255,255,${0.12 + 0.16 * intensity})`;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Kick off the morph the moment the lineup is revealed.
  useEffect(() => {
    if (revealStarted) setPhase((p) => (p === "listening" ? "morphing" : p));
  }, [revealStarted]);

  // Morph → carousel after the keyframe timeline completes.
  useEffect(() => {
    if (phase !== "morphing") return;
    const t = window.setTimeout(() => setPhase("carousel"), MORPH_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Voice-driven scroll to a specific vehicle ("show me the Ranger") — slide forward to it.
  useEffect(() => {
    const m = lineupIndex(focusedId);
    if (m < 0) return;
    setAnimate(true);
    setIndex((i) => { let j = i; while (j % LEN !== m) j++; return j; });
  }, [focusedId]);

  // Endless auto-spin while Miles is showing off the range.
  useEffect(() => {
    if (phase !== "carousel" || !spinning) return;
    const id = window.setInterval(() => { setAnimate(true); setIndex((i) => i + 1); }, SPIN_MS);
    return () => window.clearInterval(id);
  }, [phase, spinning]);

  // After a slide crosses out of the middle copy, silently snap back to the equivalent position.
  useEffect(() => {
    if (animate) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    return () => cancelAnimationFrame(r);
  }, [animate]);

  const onTrackTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== "transform" || e.target !== e.currentTarget) return;
    if (index >= 2 * LEN) { setAnimate(false); setIndex(index - LEN); }
    else if (index < LEN) { setAnimate(false); setIndex(index + LEN); }
  };

  const showCarousel = phase === "morphing" || phase === "carousel";
  const centerItem = LINEUP[index % LEN] ?? LINEUP[HERO_INDEX];
  const cells = Array.from({ length: COPIES * LEN }, (_, abs) => ({ abs, item: LINEUP[abs % LEN] }));

  return (
    <div className="reveal" data-phase={phase}>
      <div className="reveal-bg" />
      <canvas ref={canvasRef} className="ribbon-canvas" />
      <div className="reveal-flash" />
      <div className={`reveal-hint ${speaking ? "is-dim" : ""}`}>
        Miles is listening — tell him about your life.
      </div>

      {/* Edge filter that turns the truck render into a glowing wireframe outline. */}
      <svg className="reveal-defs" aria-hidden="true" width="0" height="0">
        <defs>
          <filter id="carEdge" x="-20%" y="-20%" width="140%" height="140%">
            <feMorphology in="SourceAlpha" operator="dilate" radius="2.4" result="dil" />
            <feComposite in="dil" in2="SourceAlpha" operator="out" result="rim" />
            <feFlood floodColor="#cfe6ff" result="col" />
            <feComposite in="col" in2="rim" operator="in" result="crim" />
            <feGaussianBlur in="crim" stdDeviation="1.4" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="crim" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {showCarousel && (
        <div className="carousel">
          <div className="carousel-name">{centerItem.label}</div>
          <div
            className={`carousel-track ${animate ? "" : "no-anim"}`}
            style={{ ["--idx" as string]: String(index) } as React.CSSProperties}
            onTransitionEnd={onTrackTransitionEnd}
          >
            {cells.map(({ abs, item }) => (
              <div key={abs} className={`carousel-item ${abs === index ? "is-center" : ""}`}>
                <img className="car-img solid" src={lineupImage(item.id)} alt={item.label} draggable={false} />
                {abs === index && phase === "morphing" && (
                  <>
                    <img className="car-img m-ghost" src={heroImg} alt="" aria-hidden="true" draggable={false} />
                    <div
                      className="car-img m-mesh"
                      style={{ WebkitMaskImage: `url(${heroImg})`, maskImage: `url(${heroImg})` }}
                    />
                    <img className="car-img m-outline" src={heroImg} alt="" aria-hidden="true" draggable={false} />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
