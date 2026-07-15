# Miles — Product Requirements Prompt (PRP)

*Pipeline artifact (step 1 output). Human-readable companion to `miles_prp.json`. Feeds the step-2 task builder.*

**Product type:** AI App
**Framework:** Vibe Coding Five-Step Framework

---

## Project overview

**App name:** Miles

**Idea / goal:** A conversational AI concierge on Ford.com that has a short human conversation with a shopper (name, lifestyle, passengers, daily use), recommends and visually builds a matching Ford truck or van in a live 3D scene, walks them through color, wheels, interior, and bed accessories, and books a test drive. Prototype scope: one full end-to-end path (F-150 Lariat) plus a 6-vehicle selection carousel, built as a coded React/Three.js web prototype with a live LLM, for a client/investor pitch.

**Vibe / style:** Premium, cinematic, modern. Every transition feels like an unbroken camera move, not a page load. Warm and human in voice, high-fidelity and reactive in visuals.

---

## Target audience

**Who it's for:** Prototype audience is client/investor decision-makers in a live pitch. The represented end user is a prospective Ford truck/van shopper who knows they need a capable vehicle but isn't fluent in trims and packages, and would rather describe their life than decode a config tool.

**Problem solved:** Online vehicle configuration is a form, not a conversation. Shoppers face a wall of trims and toggles before knowing what fits their life, and the emotional "this is my truck" moment is lost in menus.

**Contextual factors:** The demo must be self-evidently impressive and survive a live walk-through without breaking. Optimize for narrative clarity and "wow" moments over production completeness. No real PII collected; booking is mocked.

---

## User journey

1. Miles greets the shopper as a glowing orb and asks name, weekend activities, usual passenger count, and daily vehicle use.
2. As Miles interprets answers, the orb begins to resolve toward a vehicle silhouette.
3. The orb resolves: full outline → transparent wireframe mesh → full 3D vehicle, then zooms out into a carousel of Ford trucks and vans with the recommended match centered.
4. User confirms a vehicle; the scene transitions to a 3D three-quarter hero view with the model name to the left and circular color swatches.
5. Miles helps pick an exterior color; the 3D vehicle updates live.
6. Camera zooms into the wheels; Miles guides wheel selection.
7. Camera moves through the window into a 3D interior; interior color updates on request.
8. For trucks, Miles offers bed accessories and zooms to the back of the truck.
9. Camera pulls back to the finished three-quarter build; a booking panel fills in from conversation (name, email, date/time, location).
10. Final confirmation screen with "See Build" and "Review Booking" CTAs.

---

## Core features

### Level 1 — MVP (the pitch build)
- Live LLM-powered Miles with a Ford-voiced persona (text; voice optional).
- Discovery conversation with recommendation logic mapping answers to one of 6 vehicles.
- Orb → outline → mesh → 3D → carousel morph sequence (shader/material transition on a single model).
- 6-vehicle carousel — Maverick, Ranger, F-150, Super Duty, E-Transit, Transit (hero visuals for five, full path for F-150 Lariat).
- F-150 Lariat deep build: 10 exterior colors, 6 wheel sets, 3 interior color-ways, bed accessories.
- 3D scene that updates live from conversation via a shared config state object.
- Cinematic camera transitions across scene stages.
- Mocked booking flow that fills from conversation.
- Final confirmation screen with See Build / Review Booking CTAs.

**Key inputs:** name; weekend/lifestyle activities; usual passenger count; daily use/cargo needs; vehicle selection; color/wheel/interior/accessory choices; booking details (name, email, date/time, location).

**Key outputs:** a matched vehicle recommendation; a fully configured live-rendered 3D build; a mocked test-drive confirmation; a build recap screen.

### Level 2 — Platform enhancements (out of scope)
Full deep-build path for all 6 vehicles and more trims; real dealer-scheduling API; save/share a build; user accounts; analytics instrumentation.
1
### Level 3 — Future complexity (out of scope)
Real-time voice conversation; live pricing/financing; live dealer inventory; multi-language; AR "view in your driveway"; CRM/dealer lead handoff.

---

## Technical stack

- **Front end:** React, Vite, Tailwind CSS.
- **3D:** Three.js via react-three-fiber + drei — single glTF/GLB model per vehicle with runtime material/mesh swaps for color, wheels, interior, and accessories; orb→mesh→solid is a shader transition on that model.
- **AI:** Live LLM (model TBD — Claude / Gemini / GPT) with structured output / function calling to drive scene state.
- **Backend:** none for prototype (in-memory state); booking mocked, no PII stored.
- **Voice (optional):** Web Speech API or cloud STT/TTS.
- **Version control (mandatory):** Git + GitHub, feature-branch-per-stage, frequent checkpoints.

---

## Contextual enhancements

**Reference:** Ford F-150 Lariat build configurator (source of current color/wheel/interior/accessory option lists).

**System-prompt rules for Miles:**
- Warm, knowledgeable Ford concierge; conversational, never a spec sheet.
- Adhere to Ford brand voice (copywriter-owned).
- Emit structured config updates (`recommendedVehicle`, `exteriorColor`, `wheel`, `interiorColor`, `accessories[]`, `bookingInfo{}`) alongside natural conversation.
- Deterministic-enough recommendation so the demo reliably reaches the F-150 path.
- No real PII; booking mocked.