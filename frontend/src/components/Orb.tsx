import { useEffect, useRef } from "react";

/**
 * The voice-form "orb": a glowing, audio-reactive light form on a bright studio stage — the
 * pre-reveal visual the user talks to (matches the demo's opening beat before the truck appears).
 * Canvas-drawn with additive-blended radial blobs; pulses harder while Miles is speaking.
 * (The orb-morphs-into-the-truck transition is handled on the 3D stage at model reveal.)
 */
export function Orb({ speaking }: { speaking: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;

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
    let intensity = 0; // eased speaking level

    const draw = () => {
      t += 0.016;
      const target = speakingRef.current ? 1 : 0;
      intensity += (target - intensity) * 0.08;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h * 0.46;
      ctx.clearRect(0, 0, w, h);

      const pulse = 1 + (0.03 + 0.10 * intensity) * Math.sin(t * (2 + 4 * intensity));
      const base = Math.min(w, h) * 0.15 * pulse;

      ctx.globalCompositeOperation = "lighter";
      // soft halo
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 3.4);
      halo.addColorStop(0, "rgba(255,255,255,0.85)");
      halo.addColorStop(0.28, `rgba(120,180,255,${0.35 + 0.25 * intensity})`);
      halo.addColorStop(0.62, "rgba(11,98,224,0.12)");
      halo.addColorStop(1, "rgba(11,98,224,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, base * 3.4, 0, Math.PI * 2);
      ctx.fill();

      // drifting inner lobes give the "living light" wobble
      for (let i = 0; i < 6; i++) {
        const a = t * (0.4 + i * 0.13) + i * 1.7;
        const spread = base * (0.22 + 0.10 * intensity);
        const ox = Math.cos(a) * spread;
        const oy = Math.sin(a * 1.25) * spread;
        const r = base * (0.55 + 0.22 * Math.sin(t * 1.3 + i));
        const lobe = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r * 2.2);
        lobe.addColorStop(0, "rgba(255,255,255,0.55)");
        lobe.addColorStop(1, "rgba(150,195,255,0)");
        ctx.fillStyle = lobe;
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="orb-screen">
      <div className="orb-bg" />
      <canvas ref={canvasRef} className="orb-canvas" />
      <div className={`orb-hint ${speaking ? "orb-hint-dim" : ""}`}>
        Miles is listening — tell him about your life.
      </div>
    </div>
  );
}
