# Claude Code Brief — Restructure the Miles POC (repo-specific)
### Persona-driven · budget-anchored · capability-first — built on the existing codebase

> **How to use:** commit this as `MILES_3.0_BRIEF.md` at repo root and point Claude Code at it. Work **one phase at a time**, each ending in a build that runs + acceptance criteria that pass. Strategy rationale is in `Miles_3.0_Restructuring.md`.
>
> **Terminology to avoid confusion:** the **runtime conversational model is Gemini Live** (native-audio, voice-first). **Claude Code is only the developer tool** editing this repo. Do not swap the runtime model.

---

## 0. Ground truth about this repo (from audit — verify, don't assume)

**Stack**
- **Backend:** Python · FastAPI · **Gemini Live API** (native-audio + function calling). Single-container deploy (`Dockerfile` builds the Vite frontend and serves it + `/ws` from FastAPI). Cloud Run.
- **Frontend:** React 18 · TypeScript · Vite · **React-Three-Fiber** (`@react-three/fiber ^8.17`, `@react-three/drei ^9.114`, `three ^0.169`). **No state library** — plain `useState` in `App.tsx`, driven by WebSocket `ToolEvent`s.

**Key files (confirmed)**
| Concern | File |
|---|---|
| Session state machine (`phase` is a **derived property**) | `app/state.py` — `PROFILING_FIELDS`, `PHASES`, `LOCKED_MODEL="f-150-lariat"`, `SessionState`, `render_block()` |
| Tool gating + handlers (validates vs KB) | `app/tools.py` — `gate()`, `HANDLERS`, `h_select_model` (hard-locks to F-150) |
| KB loader | `app/kb.py` |
| Two-tier catalog | `car_configurations.json` — Tier-1 `lineup` (6 vehicles, name+character), Tier-2 `models` (**only `f-150-lariat`** full tree; only price is its trim `starting_price_usd: 62995`) |
| Tool schemas | `tools.json` (declares Anthropic-format defs; **runtime is Gemini** — follow the file's existing convention) |
| System prompt (voice/taskflow/guardrails) | `system_prompt.md` — **static per session**; **40-word / one-question-per-turn HARD limit** |
| Prompt assembly + per-turn reminder | `app/agent.py` — `_render_system_prompt` (token substitution once), `[STATE]` injected each turn as `<system-reminder>` |
| Cross-session memory | `app/memory.py` · Dealer lookup (real, Google Places) | `app/retailer.py` |
| Frontend shell + screen router + WS | `frontend/src/App.tsx` — router: `!started→greeting · finalized||booked→summary · stage.model→configurator · else→reveal` |
| Screens | `frontend/src/screens/{Greeting,Reveal,Configurator,Summary}Screen.tsx` |
| Lineup config | `frontend/src/config/lineup.ts` (`LINEUP`, `HERO_ID`) |
| Materials (PBR keyed to KB ids) · 3D model | `frontend/src/config/materials.ts` · `frontend/src/three/CarModel.tsx` (`MODEL_URL` = placeholder CX-5 glb) |
| **Pricing (hardcoded — the hook we make dynamic)** | `frontend/src/config/spec.ts` — `PRICING`, `buildSummary()`, `OFFERS` |
| Event/stage types | `frontend/src/types.ts` |

**What's missing today:** no budget anywhere · no persona logic · reveal locked to F-150 · cosmetics not price-bound · one static voice · **no test suite**.

**Phase 0 task:** open `docs/AUDIT.md`, confirm each row above with line numbers, and list any deltas. **No source changes in Phase 0.**

---

## 1. Operating rules (every session)

1. **This is an evolution, not a rewrite.** Extend the existing `phase` machine, `SessionState`, `gate()`, and tool handlers. Do not replace them.
2. **Never touch the 3D/material pipeline.** `three/*` and the material node names in `config/materials.ts` (`CarPaint`, `WheelChrome`, `intLeather*`, …) are load-bearing. Drive visuals from state only. If a change would edit `three/*`, stop and ask.
3. **Content is data.** Persona voice, persona→trim mapping, budget tiers, prices, and RSF lines live in `content/personas/**` and `car_configurations.json`. Never hardcode vehicle names, prices, or Miles's lines in Python components or `.tsx`.
4. **Respect the voice-first limits.** Every Miles turn stays **≤40 words, exactly one question**. New steps must **replace** turns (needs questions) or add **at most one** (budget); persona is inferred **silently** (0 extra turns).
5. **Don't swap the runtime model or the system-instruction mechanism.** Inject persona tone via the **existing per-turn `<system-reminder>`** (`state.render_block()`), not by re-issuing the Gemini system instruction mid-session.
6. **Feature-flag everything.** Env `MILES_FLOW` (`miles2` default | `miles3`). Keep v2 runnable until v3 is accepted.
7. **Budget is a hard invariant.** No code path may surface a recommendation or summary above `budget.max` when an in-budget option exists.
8. **Test the pure logic.** `app/persona.py` and `app/budget.py` must ship with `pytest` unit tests + fixtures (there's no suite today — create `tests/`).
9. **Small, reviewable steps.** Show a diff plan before large edits; wait for confirmation. Report repo deltas instead of assuming.

---

## 2. Phased plan (each phase: runs green + acceptance criteria)

### Phase 0 — Audit → `docs/AUDIT.md`
Confirm §0 with line numbers; list deltas; **no source changes**.
**Accept:** every §0 row verified; deltas section present.

### Phase 1 — Data layer: persona + budget + catalog enrichment (pure, tested; no behavior change yet)
- Create `content/personas/{build,thrill,adventure}/persona.json | tone.md | lines.json` (schemas in §3).
- Enrich `car_configurations.json`: add `personaTags{build,thrill,adventure}` + `price` to each Tier-1 `lineup` entry; add `price` to each color/wheel/interior option in the F-150 tree; add a `price` to the trim. Flag every placeholder `// TODO: verify price`.
- `app/persona.py` — `score(profile, registries) -> {scores, dominant, confidence}` (weights read from `persona.json`).
- `app/budget.py` — `running_total(state, kb)`, `option_delta(kb, model, category, id)`, `in_budget(state, kb)`.
- `app/kb.py` — add helpers: `lineup_by_persona(p, max_price)`, `option_price(...)`.
- `tests/` — pytest for scoring + budget.
**Accept:** unit tests prove (a) each needs pattern → expected dominant persona; (b) low-margin inputs → low confidence; (c) `running_total` sums base trim + option deltas; (d) `lineup_by_persona` never returns an over-budget hero when an in-budget option exists. No runtime behavior changed yet.

### Phase 2 — Extend `SessionState` + phases (behind `miles3`)
- Add to `SessionState`: `budget: dict`, `persona: dict`, `running_total: int`. Change `PROFILING_FIELDS` to the needs-mapped set (keep them lifestyle-framed): e.g. `["life_mode","passengers","daily_use","powertrain_comfort"]` (safety folded into `life_mode`/copy).
- Extend the derived `phase`: insert a `budget` step **between** `discovery` and `reveal`. Add `persona` population (call `app/persona.py` once discovery completes).
- Extend `render_block()` to emit `budget=…`, `running_total=…`, and — once persona locks — `persona=<dominant>` + the compact tone cue (§4).
**Accept:** with `miles3` on, `/state` in the CLI shows needs→budget→persona progression; v2 still works with the flag off.

### Phase 3 — Budget capture + tone fork (backend)
- Add a `set_budget` tool (`tools.json` + `h_set_budget` in `tools.py`), gated to the `budget` phase; writes `budget{min,max,monthly}`. One warm question, tied to Ford Pre-Qualify framing (copy only).
- In `app/agent.py`, load the active persona's `tone.md` and inject it through the per-turn `<system-reminder>` once `persona.dominant` is set.
- Update `system_prompt.md` taskflow: `discovery → budget (one question) → reveal → config`; keep the 40-word rule; add fine-tune + escape-hatch instructions.
**Accept:** Miles asks budget exactly once; `budget` populates; Miles's wording visibly differs by persona for the same beat; `grep` shows no vehicle names/lines hardcoded in new code.

### Phase 4 — Unlock the reveal (persona-matched recommendation)
- Replace `LOCKED_MODEL` usage with `recommend(state, kb)` → best Tier-1 vehicle by persona **within `budget.max`**; write it to `state.config["model"]`.
- Relax `h_select_model`: accept any Tier-1 id; **deep-build** proceeds only where a Tier-2 tree exists (F-150 today) — otherwise reveal + frame the pick and either gate deep-build as "coming soon" or fall back to the F-150 demo path (make this behavior a flag).
- `focus_lineup_model`/`show_lineup` center on the recommended vehicle.
**Accept:** an Adventure-leaning profile reveals a Ranger (framed); a Build profile reveals F-150 and deep-builds; nothing revealed exceeds `budget.max`.

### Phase 5 — Budget-anchored configuration + fine-tuning (backend + frontend)
- Config option handlers return the option's **price delta**; `state.running_total` updates each selection; block/flag options that would exceed `budget.max` with an honest trade-off prompt.
- Add fine-tune intents ("more capable / cheaper / bolder") that re-run `recommend` or swap options; enforce ≤3 options per step in the taskflow.
- Frontend: make `spec.ts::PRICING` a function of the live config + a price map; add a persistent **BudgetHud** chip (reads `ToolEvent.config` + prices); `SummaryScreen` asserts and displays `running_total ≤ budget.max`.
- `RevealScreen` takes a `persona` prop → orb hue/motion from `persona.json.orbSignal`.
**Accept:** you cannot reach a summary above `budget.max`; the HUD total matches `budget.running_total`; a fine-tune nudge measurably changes the build; ≤3 options ever shown.

### Phase 6 — Handoff integrity + instrumentation
- `h_book_test_drive` payload carries the **full config + running_total + persona**; extend `types.ts` (`ToolEvent`, `StageState`, `BookingDetails`) accordingly; nothing resets.
- Emit analytics events: phase entered/completed, budget captured, persona+confidence, option changed, fine-tune used, summary in-budget, booking submitted.
**Accept:** booking payload contains the exact built config + price; every metric in strategy §9 has an event.

### Phase 7 — Cutover
Flip `miles3` default on; keep `miles2` one release; then remove v2 + `LOCKED_MODEL`.
**Accept:** full walkthrough green on Cloud Run staging; audit deltas resolved/documented.

---

## 3. Data schemas (create in Phase 1)

**`content/personas/<p>/persona.json`**
```json
{
  "id": "build",
  "label": "Build",
  "rsfPrompt": "What do you need to get done?",
  "scoringWeights": {
    "life_mode":         { "project_home": 3, "trails_camp": 0, "the_drive": 0 },
    "daily_use":         { "work_haul": 3, "family": 2, "commute": 1, "play": 0 },
    "powertrain_comfort":{ "gas": 0, "hybrid": 0, "ev": 0 }
  },
  "priorityOptionCategories": ["capability", "safety", "tech"],
  "orbSignal": { "hue": "#1F5FA6", "motion": "steady" }
}
```
**`content/personas/<p>/tone.md`** — plain-language voice delta injected per-turn once persona locks (seed: strategy §5). Must respect the 40-word rule.
**`content/personas/<p>/lines.json`**
```json
{ "beatMicrocopy": { "budget": ["…"], "reveal": ["…"], "fineTune": ["…"] },
  "rsfModularLines": ["READY. SET. GET BEHIND THE WHEEL"] }
```
**`car_configurations.json` enrichment (additive)**
```json
"lineup": [
  { "id": "ranger", "name": "Ford Ranger", "segment": "Midsize pickup",
    "character": "…", "price": 38000,                         // TODO: verify price
    "personaTags": { "build": 1, "thrill": 1, "adventure": 3 } }
],
"models": { "f-150-lariat": {
  "trims": [{ "id":"lariat", "starting_price_usd": 62995 }],
  "exterior_colors": [{ "id":"agate-black", "price": 0 /* delta */, "...": "..." }],
  "wheels":          [{ "id":"22-chrome",   "price": 1595 }],
  "interiors":       [{ "id":"activex-truffle", "price": 0 }]
}}
```
**`SessionState` additions** (`app/state.py`)
```python
budget: dict = field(default_factory=dict)     # {"min":40000,"max":55000,"monthly":700}
persona: dict = field(default_factory=dict)     # {"scores":{...},"dominant":"build","confidence":0.44}
running_total: int = 0
```

---

## 4. Tone injection contract (the one subtle bit)
`system_prompt.md` (static, per session) keeps the **base** voice + 40-word rule. Once `persona.dominant` is set, `app/agent.py` appends the active persona's `tone.md` delta to the per-turn `<system-reminder>` alongside `[STATE]`. Never re-issue the Gemini system instruction mid-session.

## 5. Voice & content guardrails
- RSF voice = Inspiring · Determined · Impassioned; benefit over feature; simple, punchy.
- `READY. SET. ___` only at the booking peak, only from `lines.json`; never "READY. SET. [pillar]".
- Safety/tech copy = protection & control, never surveillance.
- New lines go in `lines.json` as `// TODO: brand review`, never inline.

## 6. How to prompt Claude Code across sessions
- Start: *"Read MILES_3.0_BRIEF.md and docs/AUDIT.md. We're on Phase N — propose a diff plan and wait for my OK."*
- Guard the 3D: *"If any change touches `three/*` or material node names, stop and ask."*
- Keep it data-first: *"If this is copy or mapping, edit `content/**` or `car_configurations.json`, not components."*
- Verify: *"Run the build + Phase N acceptance criteria; paste results. Keep every Miles turn ≤40 words, one question."*
- Stay honest to the repo: *"If reality differs from the brief, tell me and adapt."*

## 7. Definition of done
An undecided shopper can: answer lifestyle questions that silently resolve a persona → state a budget in one warm turn → be revealed a **persona-matched vehicle in budget** → configure cosmetics that never break budget → hear Miles narrate in the right persona voice → reach an **in-budget summary** → book a test drive whose payload preserves the full build — all voice-first within the 40-word rule, `three/*` untouched, `app/persona.py`/`app/budget.py` tested, v2 removed, and the strategy-doc metrics instrumented.
