"""In-session state machine.

The app owns phase + collected data and injects a compact [STATE] block into the model's
context each turn. Phase transitions and tool legality are decided here in code, not left to
the model to infer from the transcript.

Miles 3.0 (behind MILES_FLOW=miles3) adds a needs-mapped discovery set, a budget phase, and
silent persona inference; miles2 (default) keeps the shipped behavior unchanged.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .flags import is_miles3

# --- discovery fields ---
# miles2: the shipped lifestyle set.
PROFILING_FIELDS_V2 = ["passenger_count", "driving_environment", "daily_car_use", "weekend_vibe"]
# miles3: needs-mapped set (still asked in warm lifestyle framing). life_mode/daily_use/
# powertrain_comfort feed persona scoring (app/persona.py); passengers is for trim sizing.
PROFILING_FIELDS_V3 = ["life_mode", "daily_use", "powertrain_comfort", "passengers"]
# Back-compat alias for anything importing the name directly.
PROFILING_FIELDS = PROFILING_FIELDS_V2

PHASES = ["greeting", "lineup", "discovery", "reveal", "config", "booking", "crm"]
PHASES_V3 = ["greeting", "discovery", "budget", "reveal", "config", "booking", "crm"]

# POC: the deep-build trim (only vehicle with a Tier-2 tree). miles3 reveals a persona-matched
# vehicle but still deep-builds here (see docs/AUDIT.md decision #3).
LOCKED_MODEL = "f-150-lariat"


def profiling_fields() -> list[str]:
    return PROFILING_FIELDS_V3 if is_miles3() else PROFILING_FIELDS_V2


@dataclass
class SessionState:
    full_name: str | None = None
    profile: dict = field(default_factory=dict)          # profiling fields
    lineup_shown: bool = False
    lineup_focus: str | None = None                      # vehicle centred in the browse carousel
    config: dict = field(default_factory=dict)           # model / exterior_color / wheel / interior
    config_finalized: bool = False                       # display_car_configuration called
    profiling_declined: bool = False                     # user opted out of discovery
    retailer: str | None = None
    booking: dict = field(default_factory=dict)          # date / time / wow moments
    booked: bool = False

    # ---- Miles 3.0 ----
    budget: dict = field(default_factory=dict)           # {"min","max","monthly"}
    persona: dict = field(default_factory=dict)          # {"scores","dominant","confidence"}
    running_total: int = 0
    revealed_model: str | None = None                    # persona-matched Tier-1 vehicle shown at reveal

    # ---- derived readiness ----
    @property
    def profiling_complete(self) -> bool:
        return self.profiling_declined or all(self.profile.get(f) for f in profiling_fields())

    @property
    def config_complete(self) -> bool:
        return all(self.config.get(k) for k in ("model", "exterior_color", "wheel", "interior"))

    @property
    def budget_set(self) -> bool:
        return bool(self.budget.get("max"))

    def update_persona(self) -> None:
        """Populate self.persona from the collected profile once discovery completes (miles3 only)."""
        if not is_miles3() or not self.profiling_complete:
            return
        from . import persona as persona_mod
        self.persona = persona_mod.score(self.profile, persona_mod.load_registries())

    def update_running_total(self) -> None:
        """Recompute the running build total from the live config (miles3 only)."""
        if not is_miles3() or not self.config.get("model"):
            return
        from . import budget as budget_mod
        self.running_total = budget_mod.running_total(self)

    @property
    def phase(self) -> str:
        return self._phase_v3() if is_miles3() else self._phase_v2()

    def _phase_v2(self) -> str:
        if not self.full_name:
            return "greeting"
        if not self.lineup_shown and not self.profile:
            return "lineup"
        if not self.profiling_complete:
            return "discovery"
        if not self.config.get("model"):
            return "reveal"
        if not (self.config_complete and self.config_finalized):
            return "config"
        if not self.booked:
            return "booking"
        return "crm"

    def _phase_v3(self) -> str:
        if not self.full_name:
            return "greeting"
        if not self.profiling_complete:
            return "discovery"
        if not self.budget_set:
            return "budget"
        if not self.config.get("model"):
            return "reveal"
        if not (self.config_complete and self.config_finalized):
            return "config"
        if not self.booked:
            return "booking"
        return "crm"

    def missing_profiling(self) -> list[str]:
        return [f for f in profiling_fields() if not self.profile.get(f)]

    def render_block(self) -> str:
        """The [STATE] block injected each turn. Treated by the model as ground truth."""
        self.update_persona()
        self.update_running_total()
        lines = [f"phase={self.phase}"]
        if self.full_name:
            lines.append(f"name={self.full_name}")
        if self.phase in ("lineup", "discovery"):
            have = [f for f in profiling_fields() if self.profile.get(f)]
            lines.append(f"profiling_have={have or '[]'}")
            lines.append(f"profiling_need={self.missing_profiling() or '[]'}")
        if is_miles3():
            if self.budget:
                lines.append(f"budget={self.budget}")
            dominant = self.persona.get("dominant")
            if dominant:
                lines.append(f"persona={dominant} confidence={self.persona.get('confidence')}")
            # At the reveal, tell Miles which vehicle to reveal (persona-matched, in budget).
            if self.budget_set and not self.config.get("model"):
                from . import persona as persona_mod
                rec = persona_mod.recommend(self)
                if rec:
                    lines.append(f"recommended={rec}")
            if self.revealed_model:
                lines.append(f"revealed={self.revealed_model}")
            if self.running_total:
                lines.append(f"running_total={self.running_total}")
        if self.config:
            lines.append(f"config={self.config}")
        if self.config_finalized:
            lines.append("config_finalized=true")
        if self.retailer:
            lines.append(f"retailer={self.retailer}")
        if self.booking:
            lines.append(f"booking={self.booking}")
        if self.booked:
            lines.append("booked=true")
        return "[STATE] " + " | ".join(lines)
