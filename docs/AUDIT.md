# Miles 3.0 — Phase 0 Audit (repo ground truth)

**Purpose:** confirm the ground-truth table in `claude/Miles_3.0_ClaudeCode_Prompt.md §0` against the
real code (file + line), and record the deltas the brief does not mention. **No source changes were
made in this phase.**

Verified on branch `main` at the state after the reveal/carousel/summary rework (commit `b67fa81`).

---

## 1. Confirmed ground-truth table

| Concern | Brief says | Reality (file:line) | Status |
|---|---|---|---|
| Session state machine | `app/state.py` — `PROFILING_FIELDS`, `PHASES`, `LOCKED_MODEL`, `SessionState`, `render_block()`; `phase` is derived | `PROFILING_FIELDS` `state.py:11` · `PHASES` `state.py:12` · `LOCKED_MODEL="f-150-lariat"` `state.py:15` · `class SessionState` `state.py:19` · `phase` property `state.py:41` · `render_block()` `state.py:59` | ✅ Confirmed |
| Tool gating + handlers | `app/tools.py` — `gate()`, `HANDLERS`, `h_select_model` hard-locks | `gate()` `tools.py:34` · `h_select_model` (rejects non-`LOCKED_MODEL`) `tools.py:88` · `HANDLERS` `tools.py:178` | ✅ Confirmed |
| KB loader | `app/kb.py` | `load_kb()` `kb.py:13`, `lineup()` `kb.py:18`, `model()` `kb.py:22` | ✅ Confirmed |
| Two-tier catalog | Tier-1 `lineup` (6 vehicles), Tier-2 `models` = only `f-150-lariat`; price only `starting_price_usd:62995` | `lineup` (6 entries) `car_configurations.json:9-16` · `models.f-150-lariat` `:18-68` · `trims[0].starting_price_usd:62995` `:32` | ✅ Confirmed |
| Tool schemas | `tools.json` (Anthropic-format defs; runtime is Gemini) | 12 tools declared `:10–207`; converted to Gemini decls in `agent.py:_build_tool` (`agent.py:52`, `_convert_schema` `:35`) | ✅ Confirmed (see Delta D6 — tool list grew) |
| System prompt | `system_prompt.md` static per session; **40-word / one-question** hard limit | 40-word hard limit `system_prompt.md:59-61`; one-question rule `:62` | ✅ Confirmed |
| Prompt assembly + per-turn reminder | `app/agent.py` — `_render_system_prompt` (once), `[STATE]` injected each turn as `<system-reminder>` | `_render_system_prompt` `agent.py:64` · `_with_state()` wraps `<system-reminder>` `agent.py:150-151` · `render_block()` `agent.py:148` | ⚠️ Confirmed **with a major caveat** — see Delta D1 |
| Cross-session memory | `app/memory.py` | `set_insight` `memory.py:37`; `PROFILING_KEYS` `:18`; `TOP_LEVEL_KEYS` `:19` | ✅ Confirmed |
| Dealer lookup | `app/retailer.py` (real, Google Places) | `find_nearest()` Places Text Search, graceful fallback | ✅ Confirmed |
| Frontend shell + router + WS | `App.tsx` router: `!started→greeting · finalized\|\|booked→summary · stage.model→configurator · else→reveal` | `type Screen` `App.tsx:23` · router `App.tsx:179` | ✅ Confirmed (screen names/behavior match) |
| Screens | `screens/{Greeting,Reveal,Configurator,Summary}Screen.tsx` | all present | ✅ Confirmed (see Delta D3) |
| Lineup config | `config/lineup.ts` — `LINEUP`, `HERO_ID` | `LINEUP` `lineup.ts:13` · `HERO_ID="f-150-lariat"` `lineup.ts:23` | ✅ Confirmed |
| Materials · 3D | `config/materials.ts` · `three/CarModel.tsx` (`MODEL_URL` = placeholder CX-5) | `MODEL_URL="/2026_Mazda_CX-5_NonRigged.glb"` `CarModel.tsx:19` | ✅ Confirmed |
| Pricing (hardcoded) | `config/spec.ts` — `PRICING`, `buildSummary()`, `OFFERS` | `buildSummary()` `spec.ts:17` · `PRICING` `spec.ts:37` · `OFFERS` `spec.ts:43` | ✅ Confirmed |
| Event/stage types | `types.ts` | `ToolEvent` `types.ts:3` · `BookingDetails` `types.ts:31` · `StageState` `types.ts:43` | ✅ Confirmed (see Delta D3) |
| What's missing | no budget · no persona · reveal locked · cosmetics not price-bound · one static voice · no tests | verified absent: no `MILES_FLOW`, no `content/personas/`, no `tests/`, no price/persona data | ✅ Confirmed |

---

## 2. Deltas (not in the brief — must inform the plan)

### D1 — ⚠️ The per-turn `[STATE]` reminder only fires on *typed* turns, not voice. **(highest priority)**
`_with_state()` (`agent.py:150`) is applied **only in `send_text`** (`agent.py:162-170`). `send_audio`
(`agent.py:154-160`) streams raw PCM via `send_realtime_input` with **no** accompanying
`<system-reminder>`. The runtime is voice-first, so in normal use the `[STATE]` block — and therefore
the brief's planned per-turn **persona-tone injection** — rarely reaches the model.
- **Impact:** Phase 3 tone-forking will silently not work in voice mode if implemented exactly as the
  brief describes ("inject via the existing per-turn `<system-reminder>`").
- **Fix (to design in Phase 3):** push a `send_client_content` state/tone turn at **persona-lock** and on
  **phase changes** (a lightweight context turn, `turn_complete=False`), rather than relying on the
  text-only reminder. Do **not** re-issue the Gemini system instruction mid-session (brief rule #5 still holds).

### D2 — Changing `PROFILING_FIELDS` has a 5-file blast radius, not 2.
The brief's table lists `state.py` + `system_prompt.md`. The needs-mapped field rename also requires:
- `app/memory.py:18` `PROFILING_KEYS` (must match, or insights won't nest under `profiling`),
- `tools.json` `save_user_insight` enum (`:10`),
- `tools.py:57` `h_save_user_insight` (the `passenger_count/…` → `state.profile` mapping),
- `system_prompt.md` `{user:profiling}` / USER_CONTEXT references.
Plan Phase 2 to touch all five together.

### D3 — The frontend is ahead of the brief's file table (good news).
Since the last two rounds of work, the reveal/summary are richer than the brief assumes:
- Reveal is already **orb morph → infinite auto-spin carousel → configurator**; `RevealScreen.tsx` takes
  `speaking / revealStarted / focusedId / spinning`. Adding a `persona` prop (orb hue/motion) is additive.
- `SummaryScreen.tsx` already renders the **configured 3D vehicle** + **booking detail blocks**; the
  `BudgetHud` and in-budget assertion slot in cleanly.
- New component `VoiceControl.tsx` (audio-only, no chat bubbles); dev-only `DevReveal.tsx` harness.
- `types.ts` already has `BookingDetails` (`:31`) — Phase 6 extends it rather than creates it.

### D4 — Tool + state surface already grew beyond the brief's snapshot.
`tools.json` now has **12** tools incl. `focus_lineup_model` (`:52`) and `spin_lineup` (`:68`);
`state.py` has `lineup_focus` (`:23`); `tools.py` echoes values in `save_user_insight`/`find_retailer`/
`book_test_drive` payloads for the booking blocks. Persona/budget additions layer on top of this.

### D5 — `MILES_VOICE` is pinned on the deployed Cloud Run service.
The live service sets `MILES_VOICE=Charon` as an env var (overrides the code default). Any redeploy must
keep `--update-env-vars MILES_VOICE=Charon`. (Not a code delta, but a deploy invariant.)

### D6 — The `lineup` phase already folds into the reveal.
Per the recent prompt rework, `show_lineup` is called at the **Phase 2 reveal** (after discovery), so the
derived `lineup` phase (`state.py:44`) is a brief pass-through. The brief's `budget` phase inserts between
`discovery` and `reveal`, which is compatible.

---

## 3. Product decisions recorded (from the team)

1. **Rollout:** Phase 0 audit first (this doc), then pause for sign-off before Phase 1.
2. **Thrill persona:** ship the logic now; **defer the vehicles** (Raptor/Lobo/Mustang etc.) as a content
   backlog. Thrill inference works and recommends the closest current vehicle until performance trims exist.
3. **Non-F-150 reveal:** **reveal + frame** the persona-matched vehicle (e.g. Ranger for Adventure), then
   **route the deep 3D build to the F-150** as the demo path (keeps the flow end-to-end).

---

## 4. Phase 1 readiness

Greenfield and safe to create without touching runtime behavior:
- `content/personas/{build,thrill,adventure}/{persona.json,tone.md,lines.json}` — none exist.
- `car_configurations.json` enrichment: add `personaTags` + `price` to the 6 lineup entries; `price` to
  F-150 colors/wheels/interiors; a trim `price` — all additive (flag each `// TODO: verify price`).
- `app/persona.py`, `app/budget.py`, `app/kb.py` helpers — new pure functions.
- `tests/` — no suite exists; create with pytest fixtures for scoring + budget.

**Invariants carried into every phase:** never edit `three/*` or the material node names in
`config/materials.ts`; content (names/prices/lines/tone) stays in data, never hardcoded; every Miles turn
≤40 words / one question; everything behind `MILES_FLOW` (`miles2` default) until cutover.
