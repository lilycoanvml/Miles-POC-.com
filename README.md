# Miles POC — chat-only Mazda configuration agent

A conversational agent ("Miles") that greets the user, introduces the Mazda family,
profiles their life, reveals the **2026 CX-5**, configures it, and books a test drive —
chat only for now (visuals plug into the tool `stub` payloads later).

## Architecture

| Piece | File |
|---|---|
| Two-tier knowledge base (lineup + CX-5 config tree) | `car_configurations.json` |
| Tool schemas (Anthropic tool-use format) | `tools.json` |
| System prompt (persona, taskflow, guardrails) | `system_prompt.md` |
| Tool handlers + KB validation + phase gating | `app/tools.py` |
| In-session state machine + `[STATE]` block | `app/state.py` |
| Cross-session memory (local JSON) | `app/memory.py` |
| Retailer lookup (Google Places Text Search) | `app/retailer.py` |
| Agent loop (Vertex AI Claude, adaptive thinking, prompt caching) | `app/agent.py` |
| Chat REPL | `app/cli.py` |

### How it works

- The **app owns the phase machine** (`greeting → lineup → discovery → reveal → config →
  booking → crm`). A compact `[STATE]` reminder is injected each turn so the model treats
  it as ground truth instead of inferring phase from the transcript.
- **Tools are gated and validated in code** (`app/tools.py`): config tools only fire once a
  model is selected, colours/wheels/interiors must exist in the KB for the model, and the
  reveal is locked to the 2026 CX-5. Invalid calls return an error the model recovers from.
- The **system prompt is frozen per session** and cached (`cache_control: ephemeral`), so
  every turn after the first reads it from cache.
- `select_*` / `display_*` tools return a `{state, stub}` payload — the `stub` is the seam
  the future UI renders. In chat-only mode the model narrates from it.

## Run (Google Cloud)

Claude runs on **Vertex AI**; the retailer lookup uses the **Google Places API**.

```bash
pip install -r requirements.txt

# Vertex AI auth + routing
gcloud auth application-default login          # or attach a service account
export ANTHROPIC_VERTEX_PROJECT_ID=my-gcp-project
export CLOUD_ML_REGION=us-east5                # region where the Claude model is enabled
# export MILES_MODEL=claude-opus-4-8         # override if the Vertex model-garden id differs

# Places API key (Maps Platform key with Places API enabled)
export GOOGLE_MAPS_API_KEY=AIza...

python -m app.cli
```

`/state` prints the current SessionState; `quit` exits. Cross-session memory is written to
`miles_memory.json` (delete it to start fresh).

> **Note:** Confirm the exact Claude model id enabled in your Vertex model garden — if the
> bare `claude-opus-4-8` id isn't accepted, set `MILES_MODEL` to the model-garden form.
> Vertex doesn't support Anthropic server-side tools, which is why the retailer lookup is a
> direct Places API call rather than Anthropic web search.

## UI (real-time 3D configurator)

Two-pane app: chat with Miles beside a live **React Three Fiber** stage that renders the
`2026_Mazda_CX-5_NonRigged.glb` and updates as Miles configures it. The chat backend streams
`tool` / `assistant` events over a WebSocket; the stage mirrors the authoritative
`SessionState.config`, so a colour/wheel/interior choice updates the car the moment the tool runs.

Full-bleed immersive layout (matching the Mazda reference): a top nav, a floating "Ask anything"
chat overlay bottom-left, and a screen that advances **landing → model picker → 3D configurator**.

| Piece | File |
|---|---|
| WebSocket backend (wraps `Miles.run_turn`) | `app/web.py` |
| App shell + screen router + WS handling | `frontend/src/App.tsx` |
| Top nav bar | `frontend/src/components/NavBar.tsx` |
| Floating chat overlay ("Ask anything") | `frontend/src/components/ChatOverlay.tsx` |
| Greeting / landing screen | `frontend/src/screens/GreetingScreen.tsx` |
| Model picker (fleet fan) | `frontend/src/screens/LineupScreen.tsx` + `config/lineup.ts` |
| Configurator screen (hero chrome) | `frontend/src/screens/ConfiguratorScreen.tsx` |
| Calibrated PBR material presets (keyed to KB ids) | `frontend/src/config/materials.ts` |
| 3D model + material application | `frontend/src/three/CarModel.tsx` |
| Stage (studio IBL, ACES, contact shadows, orbit) | `frontend/src/three/ConfiguratorStage.tsx` |

### Visual assets
Imagery is **sourced from Wikimedia Commons (CC)** and embedded by URL via
`frontend/src/config/webImages.ts` (auto-generated; attributions in `frontend/public/ATTRIBUTIONS.md`).
This covers the **greeting hero**, the **fleet picker** (one image per model), the **final-reveal
gallery** (CX-5 exterior + interior), and the **infotainment/CarPlay overlay**.

Swap for official Mazda press assets before production. Two notes on accuracy:
- Commons has prior-generation CX-5 photos, not the 2026 redesign — fine for the picker, but for
  the **final-reveal gallery** the accurate option is **canvas snapshots of the configured 3D car**
  (`renderer.domElement.toDataURL()` at the camera presets). Flagged for a follow-up.
- **Studio HDRI**: ship `frontend/public/studio.hdr` and switch `<Environment>` to `files=`.

### Camera & exploration
- The 3D stage flies to a **camera preset per step** (`cameraPresets.ts`): `select_exterior_color`
  → hero 3/4 front, `select_wheel` → wheel close-up, `select_interior` → cabin.
- In the interior view, an **"Explore the infotainment"** button opens the CarPlay overlay
  (`InfotainmentOverlay.tsx`).
- The **final reveal** (`display_car_configuration`) switches to the build-summary screen
  (`SummaryScreen.tsx`) with the web-sourced gallery + a config-driven spec panel.

### Run the UI (needs Node 18+)

```bash
# 1) Backend (from mazda-poc/, with Vertex env + GOOGLE_MAPS_API_KEY set as above)
pip install -r requirements.txt
uvicorn app.web:app --port 8000

# 2) Frontend
cd frontend
npm install
npm run dev                 # http://localhost:5173  (connects to ws://localhost:8000/ws)
# override the socket if needed: VITE_WS_URL=ws://host:8000/ws npm run dev
```

### No-build preview (no Node required)
`frontend/public/preview.html` is a self-contained page (three.js via CDN import-map) that renders
the real CX-5 GLB with the chrome, live paint/wheel/interior swaps, and the camera presets — handy
for showing the visuals without the full build or backend:
```bash
python3 -m http.server 5050 --directory frontend/public   # then open http://localhost:5050/preview.html
```
The chat there is a scripted stand-in; the real conversational AI runs through the Vertex backend.

### Runtime dependencies (important)
- **The GLB is Draco-compressed.** drei's `useGLTF` enables a DRACOLoader by default and fetches the
  decoder from a Google CDN at runtime — so the React app loads it as-is. For **offline / Cloud Run**,
  host the Draco decoder yourself and pass its path: `useGLTF(url, "/draco/")` (place the decoder under
  `public/draco/`). The 64 MB size is **texture-bound** (geometry is already Draco'd), so further
  shrinking means KTX2 texture compression — which trades against paint/leather fidelity.
- **Studio HDRI**: `<Environment preset="studio">` fetches from the drei CDN; ship a local `.hdr` for offline.
- **Commons images**: loaded by URL (browser-side); fine in a normal browser, swap for official assets.

### Visual-accuracy notes

- **Materials are calibrated, not final.** `materials.ts` holds tuned PBR presets per finish type
  (Soul Red = crystal/clearcoat, the greys = metallic, the micas = pearlescent). Refine the
  numbers against physical paint chips / official swatches — only this file changes.
- **Wheels are finish-only.** The GLB has one wheel geometry, so wheel choice drives finish
  (silver ↔ machine-cut ↔ black-metallic), not 17″ vs 19″ size. Source real wheel meshes to
  represent size accurately.
- **Lighting:** the stage uses `<Environment preset="studio">`, which fetches an HDRI from the
  drei CDN. For offline / Cloud Run, ship an `.hdr` in `frontend/public/` and switch to
  `<Environment files="/studio.hdr" />`.
- **Compression (fidelity-first):** the 64 MB GLB loads slowly. Compress geometry losslessly with
  Draco, leaving textures crisp — drei's `useGLTF` auto-decodes Draco, so no code change:
  ```bash
  npx @gltf-transform/cli draco frontend/public/2026_Mazda_CX-5_NonRigged.glb \
                                 frontend/public/2026_Mazda_CX-5_NonRigged.glb
  ```
  (Avoid aggressive KTX2/ETC1S texture compression here — it smears paint flake and leather grain.)

## Deploy to Cloud Run (single service)

One container serves both the built frontend and the `/ws` endpoint, so the browser talks to the
WebSocket same-origin (`wss://<service>/ws`) — no CORS, no separate frontend host. Claude runs on
Vertex AI via the Cloud Run service account (ADC — no key files).

**Prerequisites (once):**
```bash
PROJECT=your-gcp-project
REGION=us-east5            # a region where the Claude model is enabled in Vertex Model Garden
gcloud config set project $PROJECT
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
    aiplatform.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com
# Enable the Claude model in the Vertex AI Model Garden for $REGION.

# Runtime service account with Vertex access
gcloud iam service-accounts create miles-run
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:miles-run@$PROJECT.iam.gserviceaccount.com" \
  --role=roles/aiplatform.user

# Maps Platform key (Places API enabled) -> Secret Manager
printf '%s' "YOUR_MAPS_KEY" | gcloud secrets create miles-maps-key --data-file=-
gcloud secrets add-iam-policy-binding miles-maps-key \
  --member="serviceAccount:miles-run@$PROJECT.iam.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor
```

**Build & deploy (each release):**
```bash
gcloud builds submit --tag gcr.io/$PROJECT/miles:latest

gcloud run deploy miles \
  --image gcr.io/$PROJECT/miles:latest \
  --region $REGION \
  --service-account miles-run@$PROJECT.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --timeout 3600 \
  --set-env-vars ANTHROPIC_VERTEX_PROJECT_ID=$PROJECT,CLOUD_ML_REGION=$REGION,MILES_MEMORY_PATH=/tmp/miles_memory.json \
  --update-secrets GOOGLE_MAPS_API_KEY=miles-maps-key:latest
```
If the bare model id isn't accepted in your region, add `MILES_MODEL=<model-garden-id>` to `--set-env-vars`.

**Cloud Run notes:**
- **WebSockets** are supported; `--timeout 3600` (max 60 min) bounds a session. Each WS connection
  sticks to one instance, so the in-memory per-session `SessionState` is safe.
- **Cross-session memory** (`miles_memory.json`) is written to `/tmp` — per-instance and ephemeral.
  For durable, cross-instance memory, back `app/memory.py` with Firestore or GCS.
- **The 64 MB GLB** ships inside the image and is served by FastAPI. For faster cold starts / global
  delivery, move it (and the Draco decoder + a studio `.hdr`) to GCS/CDN and point the frontend at them.
- Set `--min-instances 1` if you want to avoid cold-start latency on the first visit.

## Notes / mocks

- `find_retailer` is **real**: it calls the Google Places API Text Search (`app/retailer.py`)
  for the nearest Mazda dealership to the user's location, returning structured
  name/address/phone. It falls back to a generated placeholder if the key is missing or the
  search yields nothing.
- `book_test_drive` is **faked** — always "available", no real scheduling (payload carries
  `"mock": true`).
- Wheel design names and interior pairings are verified against Mazda USA + dealer sources
  for the 2026 model year; swap in official data before production.
# Miles-POC-.com
