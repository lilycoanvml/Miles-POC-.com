"""In-session state machine.

The app owns phase + collected data and injects a compact [STATE] block into the model's
context each turn. Phase transitions and tool legality are decided here in code, not left to
the model to infer from the transcript.
"""
from __future__ import annotations

from dataclasses import dataclass, field

PROFILING_FIELDS = ["passenger_count", "driving_environment", "daily_car_use", "weekend_vibe"]
PHASES = ["greeting", "lineup", "discovery", "reveal", "config", "booking", "crm"]

# POC: the reveal is locked to this model regardless of profiling.
LOCKED_MODEL = "f-150-lariat"


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

    # ---- derived readiness ----
    @property
    def profiling_complete(self) -> bool:
        return self.profiling_declined or all(self.profile.get(f) for f in PROFILING_FIELDS)

    @property
    def config_complete(self) -> bool:
        return all(self.config.get(k) for k in ("model", "exterior_color", "wheel", "interior"))

    @property
    def phase(self) -> str:
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

    def missing_profiling(self) -> list[str]:
        return [f for f in PROFILING_FIELDS if not self.profile.get(f)]

    def render_block(self) -> str:
        """The [STATE] block injected each turn. Treated by the model as ground truth."""
        lines = [f"phase={self.phase}"]
        if self.full_name:
            lines.append(f"name={self.full_name}")
        if self.phase in ("lineup", "discovery"):
            have = [f for f in PROFILING_FIELDS if self.profile.get(f)]
            lines.append(f"profiling_have={have or '[]'}")
            lines.append(f"profiling_need={self.missing_profiling() or '[]'}")
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
