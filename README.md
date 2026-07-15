# Miles POC — conversational Ford vehicle builder & test-drive booking

A conversational AI concierge ("Miles") that greets the user, introduces the Ford trucks & vans
lineup, profiles their life, reveals the **Ford F-150 Lariat**, configures it (colour, wheels,
interior) on a live 3D stage, and books a test drive.

> **Prototype status.** This is a pitch/POC. The 3D model is a **placeholder** (a CX-5 body stands
> in for the F-150 until a real F-150 Lariat glTF is dropped in — see *Assets* below), and lineup /
> gallery imagery is intentionally empty pending licensed Ford press assets. Ford marks and the
> "Miles" persona need Ford brand + legal sign-off before any shipped version.

## Architecture

| Piece | File |
|---|---|
| Two-tier knowledge base (lineup + F-150 Lariat config tree) | `car_configurations.json` |
| Tool schemas (function-calling format) | `tools.json` |
| System prompt (persona, taskflow, guardrails) | `system_prompt.md` |
| Tool handlers + KB validation + phase gating | `app/tools.py` |
| In-session state machine + `[STATE]` block | `app/state.py` |
| Cross-session memory (local JSON) | `app/memory.py` |
| Dealer lookup (Google Places Text Search) | `app/retailer.py` |
| Agent loop (Gemini Live API, native-audio dialog + function calling) | `app/agent.py` |
| WebSocket backend (wraps the Live session) | `app/web.py` |
| Chat REPL | `app/cli.py` |

### How it works

- The **app owns the phase machine** (`greeting → lineup → discovery → reveal → config →
  booking → crm`). A compact `[STATE]` reminder is injected each turn so the model treats
  it as ground truth instead of inferring phase from the transcript.
- **Tools are gated and validated in code** (`app/tools.py`): config tools only fire once a
  vehicle is selected, colours/wheels/interiors must exist in the KB for the vehicle, and the
  reveal is locked to the **F-150 Lariat**. Invalid calls return an error the model recovers from.
- `select_*` / `display_*` tools return a `{state, stub}` payload — the `stub` is the seam the
  UI renders; the live 3D stage mirrors the authoritative `SessionState.config`.

## Run (backend)

Miles runs on the **Gemini Live API** (native-audio); the dealer lookup uses the **Google Places API**.

```bash
pip install -r requirements.txt

export GEMINI_API_KEY=...                      # or GOOGLE_API_KEY
export GOOGLE_MAPS_API_KEY=AIza...             # Maps Platform key with Places API enabled
# export MILES_MODEL=gemini-2.5-flash-native-audio-preview-09-2025   # override the default model
# export MILES_VOICE=Aoede                     # override the default voice

python -m app.cli                              # chat REPL ('/state' to debug, 'quit' to exit)
```

Cross-session memory is written to `miles_memory.json` (override with `MILES_MEMORY_PATH`; delete
the file to start fresh).

## UI (real-time 3D configurator)

Two-pane app: chat with Miles beside a live **React Three Fiber** stage. The chat backend streams
`tool` / `transcript` events over a WebSocket; the stage mirrors `SessionState.config`, so a
colour/wheel/interior choice updates the vehicle the moment the tool runs. Full-bleed immersive
layout: top nav, a floating "Ask anything" chat overlay, and a screen that advances
**landing → vehicle picker → 3D configurator → build summary**.

| Piece | File |
|---|---|
| App shell + screen router + WS handling | `frontend/src/App.tsx` |
| Top nav bar (Ford wordmark placeholder) | `frontend/src/components/NavBar.tsx` |
| Floating chat overlay ("Ask anything") | `frontend/src/components/ChatOverlay.tsx` |
| Vehicle picker (lineup cascade) | `frontend/src/screens/LineupScreen.tsx` + `config/lineup.ts` |
| Configurator screen (hero chrome) | `frontend/src/screens/ConfiguratorScreen.tsx` |
| Build-summary screen | `frontend/src/screens/SummaryScreen.tsx` + `config/spec.ts` |
| Calibrated PBR material presets (keyed to KB ids) | `frontend/src/config/materials.ts` |
| 3D model + material application | `frontend/src/three/CarModel.tsx` |
| Stage (studio IBL, ACES, contact shadows, orbit) | `frontend/src/three/ConfiguratorStage.tsx` |
| Camera presets per step | `frontend/src/three/cameraPresets.ts` |

### Run the UI (needs Node 18+)

```bash
# 1) Backend (with GEMINI_API_KEY + GOOGLE_MAPS_API_KEY set as above)
uvicorn app.web:app --port 8000

# 2) Frontend
cd frontend
npm install
npm run dev                 # http://localhost:5173  (connects to ws://localhost:8000/ws)
# override the socket if needed: VITE_WS_URL=ws://host:8000/ws npm run dev
```

## Assets (placeholder state — swap before the pitch)

- **3D model** — `frontend/public/2026_Mazda_CX-5_NonRigged.glb` is a **temporary stand-in** for the
  F-150 Lariat. To swap: drop the F-150 glTF into `frontend/public/`, point `MODEL_URL` in
  `frontend/src/three/CarModel.tsx` at it, and remap the material node names in
  `frontend/src/config/materials.ts` (`CarPaint`, `WheelChrome`, `intLeather*`, …). Colour/wheel/
  interior swaps already work against those node names, so the pipeline runs end-to-end today.
- **Lineup / gallery / hero imagery** — `frontend/src/config/webImages.ts` is intentionally empty
  (previous Mazda/Wikimedia assets removed). Cards fall back to text labels and the reveal gallery
  renders labelled tiles. Add Ford hero renders under `frontend/public/lineup/` and press imagery
  in `webImages.ts`. Expected lineup keys: `maverick · ranger · f-150-lariat · super-duty ·
  e-transit · transit`.
- **Colour/wheel/interior data** — sourced from the Ford F-150 Lariat configurator; the PBR values
  in `materials.ts` are tuned starting points to refine against official Ford swatches.

## Deploy (single container)

The `Dockerfile` builds the Vite frontend and serves it plus the `/ws` endpoint from one FastAPI
container, so the browser talks to the WebSocket same-origin (no CORS, no separate frontend host).
Provide `GEMINI_API_KEY` and `GOOGLE_MAPS_API_KEY` (and optionally `MILES_MODEL` / `MILES_VOICE`)
as runtime env/secrets. `MILES_MEMORY_PATH` defaults to `/tmp/miles_memory.json` (per-instance,
ephemeral — back it with a datastore for durable cross-instance memory).

> This project is **standalone** — it is not a git repo and has **no CI/CD wired up**. There is no
> deploy workflow, so nothing here can push to any existing deployment. Add your own Ford-targeted
> pipeline and service/secret names when you're ready.

## Notes / mocks

- `find_retailer` is **real**: it calls the Google Places API Text Search (`app/retailer.py`) for
  the nearest **Ford dealer** to the user's location, returning structured name/address/phone. It
  falls back to a generated placeholder if the key is missing or the search yields nothing.
- `book_test_drive` is **faked** — always "available", no real scheduling (payload carries
  `"mock": true`).
- Wheel/colour/interior names reflect the 2026 F-150 Lariat; confirm against official Ford data
  before production.
