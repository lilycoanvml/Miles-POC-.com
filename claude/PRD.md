# Miles — Conversational AI Vehicle Builder & Test-Drive Booking
### Product Requirements Document (Prototype)

**Owner:** [Your name] — AI Product Designer & Prototype Lead
**Status:** Draft v1 — for team alignment
**Last updated:** July 14, 2026
**Prototype type:** Coded web prototype (React + Three.js) · Live LLM · Built for a client/investor pitch

---

## 1. TL;DR

Miles is a conversational AI concierge that lives on Ford.com. Instead of dropping a shopper into a spec sheet, Miles has a short, human conversation — name, weekend life, how many passengers, how they use a vehicle day to day — and *builds the answer in front of them*. A glowing orb listens, then morphs into the vehicle that fits their life, fans out into a carousel of Ford trucks and vans, and once the shopper picks one, walks them through color, wheels, interior, and (for trucks) bed accessories in a live 3D scene. When the build is done, Miles books the test drive. The pitch lands on one feeling: *"the website understood me and built my truck while we talked."*

For the prototype we build **one full end-to-end path — the F-150 Lariat** — plus a **6-vehicle selection carousel** (Maverick, Ranger, F-150, Super Duty, E-Transit, Transit). Booking is mocked. This document defines what we're building, why, how, and who owns what.

---

## 2. Why we're building this

- **The problem:** Configuring a vehicle online is a form, not a conversation. Shoppers face a wall of trims, packages, and toggles before they know what fits their life, and the emotional "this is *my* truck" moment gets lost in menus.
- **The bet:** A conversational, visually reactive experience compresses discovery → configuration → intent (a booked test drive) into a single guided flow that feels personal and premium.
- **Why now / why this pitch:** The goal of this build is to *sell the vision* to the client/stakeholders. Success is measured by whether the room believes this is the future of shopping on Ford.com — not by production readiness. Every decision optimizes for narrative clarity and "wow" moments over completeness.

---

## 3. Audience

- **Primary (of the prototype):** Client / investor decision-makers in a pitch setting. The experience must be self-evidently impressive in a live demo and survive a walk-through without breaking.
- **Represented end user (inside the story):** A prospective Ford truck/van shopper who knows they need a capable vehicle but isn't fluent in trims and packages — someone who'd rather describe their life than decode a config tool.

---

## 4. Experience narrative (the full flow)

The prototype is a single continuous scene. Camera moves and morphs *are* the product — transitions should feel cinematic and unbroken, never like page loads.

**1. Arrival — the orb.** Miles appears as a glowing orb. Warm greeting, then a short discovery conversation: name → what they like to do on weekends → how many passengers they usually carry → daily vehicle use → (additional qualifying questions as needed).

**2. Understanding — the orb takes shape.** As Miles interprets answers, the orb begins to resolve toward a vehicle silhouette — a live signal that "I'm understanding you."

**3. Recommendation & selection — orb → outline → mesh → 3D → carousel.** The orb resolves into a **full outline**, then a **transparent wireframe mesh**, then a **full 3D vehicle**, which zooms out into a **carousel of Ford trucks and vans** (Maverick, Ranger, F-150, Super Duty, E-Transit, Transit) with Miles's recommended match front and center.

**4. Confirmation — the hero view.** User confirms a vehicle. The scene transitions to a **3D three-quarter view of just that vehicle**, with the model name set to the **left**. Color options appear as **small circular swatches** (matching the Ford.com build pattern).

**5. Color.** Miles converses to help pick a color; the selection updates the 3D vehicle **live**.

**6. Wheels.** Camera **zooms into the wheels**; Miles guides the shopper through wheel options to the right configuration.

**7. Interior.** Camera moves **through the window into a 3D interior view**. The cabin updates on request, with selectable **interior color options**.

**8. Bed accessories (trucks only).** Miles offers to explore bed accessories and **zooms to the back of the truck** to show them.

**9. Completed build + booking.** Camera pulls back to the **finished, customized three-quarter 3D view**. A **Booking Information** panel appears and fills in **as the user provides details**: name, email, preferred date & time, and dealer location.

**10. Confirmation screen.** A final screen with two CTAs: **"See Build"** and **"Review Booking."**

> **Scope note:** For the prototype, steps 4–9 are fully built for the **F-150 Lariat only**. The other five vehicles exist as selectable carousel entries with a hero visual, but do not have the full deep-build path.

---

## 5. Scope

### In scope (Level 1 — the pitch build)
- Live LLM-powered Miles with a defined Ford-voiced persona (text; voice optional — see open questions).
- Discovery conversation → recommendation logic mapping answers to one of the 6 vehicles.
- Orb → outline → mesh → 3D → carousel morph sequence.
- 6-vehicle carousel (hero visuals only for 5; full path for F-150 Lariat).
- F-150 Lariat deep build: 10 exterior colors, 6 wheel sets, 3 interior color-ways, bed accessories.
- Live-updating 3D scene driven by the conversation.
- Cinematic camera transitions (exterior → wheels → interior → bed → hero).
- **Mocked** booking flow (form fills from conversation; no live dealer backend).
- Final confirmation screen with "See Build" / "Review Booking."

### Out of scope (captured for context)
- **Level 2:** Full deep-build path for all 6 vehicles; additional trims; real dealer-scheduling API; save/share build; user accounts; analytics instrumentation.
- **Level 3:** Real-time voice conversation, financing/pricing, live dealer inventory, multi-language, AR "view in your driveway," CRM/lead handoff.

---

## 6. How we build it (technical approach)

**Frontend:** React + Vite + Tailwind. 3D via **Three.js** (recommend **react-three-fiber + drei** for a React-native scene graph and easier camera choreography).

**3D asset strategy — build once, swap materials.** Rather than rendering a separate model per color/wheel/interior, use a **single glTF/GLB model per vehicle** and swap **materials/meshes at runtime** for exterior color, wheel set, and interior. This is dramatically lighter, makes color changes feel instant and "live," and is the single most important technical decision for the demo feeling premium. The orb→outline→mesh→solid sequence is a **shader/material transition** on that same model (edges/wireframe → transparent → PBR material), not four separate assets.

**Conversation engine:** Live LLM (model TBD — Anthropic Claude, Gemini, or GPT). Miles needs:
- A **system prompt** encoding persona + Ford voice (owned by copywriter, integrated by lead).
- **Structured output / function calling** so the model doesn't just chat — it emits config state the 3D scene consumes: `recommendedVehicle`, `exteriorColor`, `wheel`, `interiorColor`, `accessories[]`, and `bookingInfo{}`. The conversation drives the scene through this shared state object.
- A lightweight **recommendation heuristic** mapping discovery answers (passengers, activities, daily use, cargo needs) to the 6 vehicles.

**Camera & scene:** A state machine for scene stages (`discovery → carousel → hero → color → wheels → interior → bed → complete → booking`), with scripted camera targets per stage.

**Booking:** Mocked — the panel binds to `bookingInfo` collected in conversation; "submit" shows the confirmation screen. No PII leaves the prototype.

**Voice (optional):** Web Speech API for a cheap demo, or cloud STT/TTS if we want production-grade voice for the pitch.

**Version control:** Git + GitHub from day one; feature branches per stage; frequent checkpoints (the 3D scene is fragile — commit often).

---

## 7. Assets required

All source data below was pulled from Ford's live F-150 Lariat configurator and reflects current (2026) options. **Note:** Ford serves its configurator 3D dynamically; those exact files are not directly downloadable, so each state must be captured, recreated, or sourced by design. **These are Ford's brand assets — fine for an internal prototype/pitch, but a shipped version needs Ford brand + legal sign-off on both the assets and the "Miles" persona.**

### 7a. Carousel vehicles (hero visual each)
Maverick · Ranger · F-150 · Super Duty · E-Transit · Transit
→ One high-quality 3D model **or** turntable/three-quarter hero render each. F-150 uses the full deep-build model (below).

### 7b. F-150 Lariat — full deep-build assets

**Base model & morph sequence**
- Single rideable glTF/GLB of the F-150 Lariat (SuperCrew, 5.5' box).
- Orb → outline → transparent mesh → solid 3D transition states (shader-driven on the one model).
- Three-quarter hero framing + camera targets for wheels, interior (through-window), and bed.

**Exterior colors (10)** — Agate Black Metallic · Oxford White · Iconic Silver Metallic · Carbonized Gray Metallic · Avalanche · Marsh Gray · Antimatter Blue Metallic · Argon Blue Metallic · Ruby Red Metallic Tinted Clearcoat · Star White Metallic Tri-Coat
→ PBR material per color + a swatch circle per color for the UI.

**Wheels (6)** — 18" Painted Aluminum · 18" Gloss Black · 20" Chrome-Like PVD · 20" Gloss Black · 22" Gloss Black · 22" Chrome
→ Swappable wheel meshes + thumbnail per option.

**Interior (3)** — ActiveX Medium Dark Slate · ActiveX Black · ActiveX Smoked Truffle
→ 3D cabin model with swappable interior-color materials + swatch per option.

**Bed accessories (trucks only)** — Hard Rolling tonneau · Soft-Up tonneau · Hard-Folding tonneau · Bed Divider · Foldable Bed Extender · CabHigh bed cap · Side Step Bar
→ Attachable meshes on the truck bed + thumbnail per accessory.

**UI / motion**
- Miles orb with four visual states: **idle, listening, reasoning, speaking** + the signature orb→vehicle morph.
- Swatch circles, wheel/interior/accessory thumbnails, booking panel, confirmation screen.
- Transition motion design (the cinematic feel between every stage).

---

## 8. Roles & responsibilities

| Area | Owner | Responsibility |
|---|---|---|
| Product, prototype lead, build | **[You] — AI Product Designer** | Overall direction, React/Three.js build, LLM integration, scene state machine, wiring assets + copy + strategy into the working prototype |
| Assets (2D/3D/video) | **Designer** | Source/create the F-150 Lariat model + morph states, all color/wheel/interior/accessory variants, carousel hero visuals, orb states, UI motion. Deliver in agreed formats (glTF/GLB, PBR materials, swatch/thumbnail sets) |
| Copy & voice | **Copywriter** | Miles's persona, Ford brand voice, all conversational lines and micro-copy, discovery question phrasing, CTA labels, the system-prompt voice rules |
| Strategy & flow | **Strategist** | User journey, CTA placement/timing, discovery-question logic, recommendation mapping (answers → vehicle), pacing of the pitch narrative |

**Shared dependencies:** Copywriter's voice rules feed the LLM system prompt (integrated by lead). Strategist's recommendation logic feeds the LLM's mapping and the discovery question set. Designer's asset formats must be agreed with lead *before* production (see risks).

---

## 9. Milestones (placeholders — fill in real dates)

| Phase | Target | Key deliverables |
|---|---|---|
| 0 — Alignment | [date] | This PRD signed off; asset format spec locked; LLM model chosen |
| 1 — Vertical slice | [date] | Orb → carousel → F-150 hero working with placeholder assets + live Miles |
| 2 — Deep build | [date] | Color/wheel/interior/bed swapping live; final F-150 assets in |
| 3 — Booking + polish | [date] | Mocked booking, confirmation screen, transition/motion polish |
| 4 — Pitch dress rehearsal | [date] | Full run-through, perf pass, backup recording |

---

## 10. Success metrics (for a pitch)

- **Narrative lands:** Stakeholders can restate the vision unprompted after the demo.
- **The "wow" beats hit:** orb-to-vehicle morph and live color change draw a reaction.
- **Zero-break run:** the full F-150 path completes live without stalls or visual glitches.
- **Performance:** smooth frame rate through all transitions on the demo machine.
- **Emotional read:** it *feels* like Miles understood the shopper and built their truck.

---

## 11. Risks & open questions

- **Asset formats must be locked first.** The single biggest risk is the designer producing assets (e.g., flat renders) that the runtime material-swap approach can't use. Lead + designer align on glTF/GLB + PBR materials *before* production starts.
- **Getting usable F-150 3D assets** at pitch quality is the critical path — Ford's own files aren't directly downloadable. Decide: license a stock model, commission one, or capture/rebuild.
- **Performance on the demo machine** — a full PBR truck + interior + live LLM can strain a laptop. Plan a perf budget and a pre-recorded fallback.
- **Open — voice:** text-only, or text + voice for the pitch? (Affects STT/TTS scope.)
- **Open — LLM model & latency:** which model, and is live latency acceptable in a demo, or do we pre-warm/cache the discovery turns?
- **Open — recommendation logic:** how deterministic should the answer→vehicle mapping be, so the demo reliably lands on F-150?
- **Open — Ford brand/legal:** is there any sanctioned relationship, or is this a concept/spec build? Determines how freely we use Ford marks and the "Miles" name.

---

## 12. Assumptions (correct any that are wrong)

- Miles is text-driven with voice as an optional enhancement.
- Booking is fully mocked; no real dealer scheduling and no PII stored.
- This is a prototype/pitch artifact; production would require Ford brand + legal approval.
- F-150 Lariat is the only full deep-build path; the other five vehicles are carousel-selectable with hero visuals only.
- Timeline dates are placeholders for the team to set.