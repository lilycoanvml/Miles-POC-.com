import { useCallback, useEffect, useRef, useState } from "react";
import { NavBar } from "./components/NavBar";
import { VoiceControl } from "./components/VoiceControl";
import { GreetingScreen } from "./screens/GreetingScreen";
import { RevealScreen } from "./screens/RevealScreen";
import { ConfiguratorScreen } from "./screens/ConfiguratorScreen";
import { SummaryScreen } from "./screens/SummaryScreen";
import { InfotainmentOverlay } from "./components/InfotainmentOverlay";
import type { View } from "./three/cameraPresets";
import { DEFAULT_RIG } from "./three/rig";
import type { BookingDetails, ServerEvent, StageState } from "./types";
import { AudioSink, MicStream, int16ToBase64 } from "./voice";

// Same-origin by default (single-service Cloud Run). In dev (Vite on :5173), talk
// directly to the FastAPI backend on :8000 — the WS proxy upgrade is unreliable.
const WS_URL =
  import.meta.env.VITE_WS_URL ??
  (location.port === "5173"
    ? `ws://${location.hostname}:8001/ws`
    : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);

// Screen router: landing -> voice orb/reveal -> model carousel -> 3D configurator -> build summary.
type Screen = "greeting" | "reveal" | "configurator" | "summary";

const TOOL_VIEW: Record<string, View> = {
  select_model: "hero",
  select_exterior_color: "hero",
  select_wheel: "wheel",
  select_interior: "interior",
};

export default function App() {
  const [stage, setStage] = useState<StageState>({ finalized: false, rig: DEFAULT_RIG });
  const [, setPhase] = useState("greeting");
  const [view, setView] = useState<View>("hero");
  const [connected, setConnected] = useState(false);
  const [started, setStarted] = useState(false);
  const [lineupShown, setLineupShown] = useState(false);
  const [lineupFocus, setLineupFocus] = useState<string | null>(null);
  const [lineupSpin, setLineupSpin] = useState(false);
  const [details, setDetails] = useState<BookingDetails>({});
  const [booked, setBooked] = useState(false);
  const [infotainmentOpen, setInfotainmentOpen] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const sinkRef = useRef<AudioSink | null>(null);
  const micRef = useRef<MicStream | null>(null);
  const speakingTimer = useRef<number | null>(null);

  const handleEvent = useCallback((ev: ServerEvent) => {
    if (ev.type === "audio") {
      sinkRef.current?.pushBase64Pcm16(ev.data);
      setSpeaking(true);
      if (speakingTimer.current) window.clearTimeout(speakingTimer.current);
      speakingTimer.current = window.setTimeout(() => setSpeaking(false), 600);
    } else if (ev.type === "assistant") {
      setPhase(ev.phase);
    } else if (ev.type === "tool") {
      setPhase(ev.phase);
      // Flow milestones that drive the screen router.
      if (ev.tool === "show_lineup") setLineupShown(true);
      if (ev.tool === "focus_lineup_model") {
        const m = ev.payload?.model as string | undefined;
        if (m) setLineupFocus(m);
        setLineupSpin(false); // focusing a vehicle stops the auto-spin
      }
      if (ev.tool === "spin_lineup") { setLineupSpin(true); setLineupFocus(null); }

      // Collect user-provided details as they arrive → shown as blocks on the booking screen.
      if (ev.tool === "save_user_insight" && ev.ok) {
        const cat = ev.payload?.category as string | undefined;
        const val = ev.payload?.value as string | undefined;
        if (val) {
          const key = ({ full_name: "name", email: "email", location: "location", height_cm: "height" } as Record<string, keyof BookingDetails>)[cat ?? ""];
          if (key) setDetails((d) => ({ ...d, [key]: val }));
        }
      } else if (ev.tool === "find_retailer" && ev.ok) {
        setDetails((d) => ({ ...d, location: ev.payload?.location ?? d.location, retailer: ev.payload?.retailer ?? d.retailer }));
      } else if (ev.tool === "book_test_drive" && ev.ok) {
        setBooked(true);
        setDetails((d) => ({
          ...d,
          name: ev.payload?.full_name ?? d.name,
          email: ev.payload?.email ?? d.email,
          retailer: ev.payload?.retailer ?? d.retailer,
          date: ev.payload?.date ?? d.date,
          time: ev.payload?.time ?? d.time,
        }));
      }

      if (ev.tool === "set_car_view") {
        const v = ev.payload?.view as View | undefined;
        if (v) setView(v);
      } else if (ev.tool === "animate_car") {
        const action = ev.payload?.action as string | undefined;
        setStage((s) => {
          const rig = { ...(s.rig ?? DEFAULT_RIG) };
          if (action === "open_doors") rig.doors = true;
          else if (action === "close_doors") rig.doors = false;
          else if (action === "open_trunk") rig.trunk = true;
          else if (action === "close_trunk") rig.trunk = false;
          else if (action === "spin_wheels") rig.spinWheelsUntil = performance.now() + 3000;
          return { ...s, rig };
        });
      } else {
        if (TOOL_VIEW[ev.tool]) setView(TOOL_VIEW[ev.tool]);
        setStage((s) => {
          const rig = { ...(s.rig ?? DEFAULT_RIG) };
          // selecting wheels briefly spins them so the user sees the new finish
          if (ev.tool === "select_wheel") rig.spinWheelsUntil = performance.now() + 3000;
          return {
            ...s,
            rig,
            model: ev.config.model ?? s.model,
            exteriorColor: ev.config.exterior_color ?? s.exteriorColor,
            wheel: ev.config.wheel ?? s.wheel,
            interior: ev.config.interior ?? s.interior,
            // the final reveal switches to the build-summary screen
            finalized: s.finalized || ev.tool === "display_car_configuration",
          };
        });
      }
    } else if (ev.type === "interrupted") {
      sinkRef.current?.interrupt();
      setSpeaking(false);
    } else if (ev.type === "turn_complete") {
      setSpeaking(false);
      setPhase(ev.phase);
    } else if (ev.type === "error") {
      console.error("[miles]", ev.message);
    }
  }, []);

  const start = useCallback(async () => {
    if (started) return;
    setStarted(true);
    sinkRef.current = new AudioSink(24000);
    await sinkRef.current.resume(); // user-gesture unlock for AudioContext
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => { setConnected(true); resolve(); };
      ws.onclose = () => setConnected(false);
      ws.onerror = (ev) => reject(ev);
      ws.onmessage = (e) => handleEvent(JSON.parse(e.data) as ServerEvent);
    });
  }, [handleEvent, started]);

  const startMic = useCallback(async () => {
    const mic = new MicStream();
    micRef.current = mic;
    mic.onChunk = (pcm) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "audio", data: int16ToBase64(pcm) }));
    };
    await mic.start();
    setMicActive(true);
  }, []);

  const stopMic = useCallback(async () => {
    await micRef.current?.stop();
    micRef.current = null;
    setMicActive(false);
  }, []);

  const toggleMic = useCallback(async () => {
    if (!started) await start();
    if (micActive) stopMic(); else startMic();
  }, [micActive, startMic, stopMic, start, started]);

  useEffect(() => () => {
    micRef.current?.stop();
    wsRef.current?.close();
  }, []);

  const screen: Screen =
    !started ? "greeting"
    : (stage.finalized || booked) ? "summary"
    : stage.model ? "configurator"
    : "reveal";

  // Dark chrome over the cinematic landing; light chrome over the bright stages.
  const navTheme = screen === "greeting" ? "dark" : "light";

  return (
    <div className="app">
      <NavBar theme={navTheme} />

      {screen === "greeting" && <GreetingScreen onStart={start} />}
      {screen === "reveal" && (
        <RevealScreen speaking={speaking} revealStarted={lineupShown} focusedId={lineupFocus} spinning={lineupSpin} />
      )}
      {screen === "configurator" && (
        <ConfiguratorScreen stage={stage} view={view} onOpenInfotainment={() => setInfotainmentOpen(true)} />
      )}
      {screen === "summary" && <SummaryScreen stage={stage} details={details} />}

      <InfotainmentOverlay open={infotainmentOpen} onClose={() => setInfotainmentOpen(false)} />

      {started && screen !== "summary" && (
        <VoiceControl
          connected={connected}
          started={started}
          micActive={micActive}
          speaking={speaking}
          onStart={start}
          onToggleMic={toggleMic}
        />
      )}
    </div>
  );
}
