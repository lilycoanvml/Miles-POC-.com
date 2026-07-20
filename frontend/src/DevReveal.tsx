import { useEffect, useState } from "react";
import { NavBar } from "./components/NavBar";
import { RevealScreen } from "./screens/RevealScreen";
import { SummaryScreen } from "./screens/SummaryScreen";
import { BudgetHud } from "./components/BudgetHud";
import { HERO_ID, LINEUP, lineupImage } from "./config/lineup";
import { DEFAULT_RIG } from "./three/rig";

/** Static preview (`?demo=reveal&view=summary`) of the summary screen with a mock build + details. */
function SummaryPreview() {
  const stage = {
    model: "f-150-lariat", exteriorColor: "antimatter-blue", wheel: "20-gloss-black",
    interior: "activex-black", finalized: true, rig: DEFAULT_RIG,
  };
  const details = { name: "Jordan Lee", location: "Austin, TX", retailer: "Ford Austin Central", date: "2026-08-14", time: "14:30", email: "jordan@example.com" };
  return (
    <div className="app">
      <NavBar theme="light" />
      <SummaryScreen stage={stage} details={details} budget={{ max: 70000, monthly: 900 }} runningTotal={64590} />
    </div>
  );
}

/** Static preview (`?demo=reveal&layers=1`) of the individual morph layers at full opacity. */
function LayerPreview() {
  const img = lineupImage(HERO_ID);
  const cell = { position: "relative", height: "42vh", border: "1px solid #ddd" } as const;
  const layer = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" } as const;
  return (
    <div className="reveal" data-phase="carousel" style={{ padding: 60 }}>
      <div className="reveal-bg" />
      <svg className="reveal-defs" aria-hidden width="0" height="0"><defs>
        <filter id="carEdge" x="-20%" y="-20%" width="140%" height="140%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="2.4" result="dil" />
          <feComposite in="dil" in2="SourceAlpha" operator="out" result="rim" />
          <feFlood floodColor="#cfe6ff" result="col" />
          <feComposite in="col" in2="rim" operator="in" result="crim" />
          <feGaussianBlur in="crim" stdDeviation="1.4" result="glow" />
          <feMerge><feMergeNode in="glow" /><feMergeNode in="crim" /></feMerge>
        </filter>
      </defs></svg>
      <div style={{ position: "relative", zIndex: 2, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 60 }}>
        <div style={cell}><span>outline</span><img className="car-img m-outline" src={img} style={{ ...layer, opacity: 1 } as React.CSSProperties} /></div>
        <div style={cell}><span>mesh</span><div className="car-img m-mesh" style={{ ...layer, opacity: 1, WebkitMaskImage: `url(${img})`, maskImage: `url(${img})` } as React.CSSProperties} /></div>
        <div style={cell}><span>ghost</span><img className="car-img m-ghost" src={img} style={{ ...layer, opacity: 0.6 } as React.CSSProperties} /></div>
        <div style={cell}><span>solid</span><img className="car-img solid" src={img} style={layer as React.CSSProperties} /></div>
      </div>
    </div>
  );
}

/**
 * Dev-only harness (visit `?demo=reveal`) to preview the ribbon → morph → carousel flow without
 * the voice backend. Not mounted in production. Buttons stand in for the tool events Miles emits.
 */
export function DevReveal() {
  const params = new URLSearchParams(location.search);
  const [revealStarted, setRevealStarted] = useState(params.get("state") === "carousel");
  const [focusedId, setFocusedId] = useState<string | null>(params.get("focus"));
  const [spinning, setSpinning] = useState(params.get("spin") === "1");
  const [persona, setPersona] = useState<string | null>(params.get("persona"));
  const [speaking, setSpeaking] = useState(true);
  const showLayers = params.get("layers") === "1";
  const total = params.get("total") ? Number(params.get("total")) : null;
  const max = params.get("max") ? Number(params.get("max")) : null;

  // fake speaking pulse so the ribbon reacts
  useEffect(() => {
    const t = window.setInterval(() => setSpeaking((s) => !s), 1400);
    return () => window.clearInterval(t);
  }, []);

  // auto-trigger the morph shortly after mount (for headless capture of the morph frames)
  useEffect(() => {
    if (params.get("automorph") !== "1") return;
    const t = window.setTimeout(() => setRevealStarted(true), 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (showLayers) return <LayerPreview />;
  if (params.get("view") === "summary") return <SummaryPreview />;

  return (
    <div className="app">
      <NavBar theme="light" />
      <RevealScreen speaking={speaking} revealStarted={revealStarted} focusedId={focusedId} spinning={spinning} persona={persona} />
      {max != null && <BudgetHud budget={{ max }} runningTotal={total} />}
      <div style={{ position: "absolute", left: 24, bottom: 24, zIndex: 50, display: "flex", gap: 8, flexWrap: "wrap", maxWidth: 520 }}>
        <button onClick={() => setRevealStarted(true)}>show_lineup (morph)</button>
        <button onClick={() => setSpinning((s) => !s)}>{spinning ? "stop spin" : "spin_lineup"}</button>
        {["build", "thrill", "adventure"].map((p) => (
          <button key={p} onClick={() => setPersona(p)}>persona:{p}</button>
        ))}
        {LINEUP.map((it) => (
          <button key={it.id} onClick={() => { setSpinning(false); setFocusedId(it.id); }}>{it.label}</button>
        ))}
      </div>
    </div>
  );
}
