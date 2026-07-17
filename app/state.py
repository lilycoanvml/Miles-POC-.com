"""In-session state machine.

The app owns phase + collected config and injects a compact [STATE] block into the model's
context each turn. Phase transitions and tool legality are decided here in code, not left to
the model to infer from the transcript.

The flow mirrors the Miles taskflow: greeting -> discovery -> reveal -> config -> booking -> crm.
Profiling in discovery is captured conversationally (no tool calls), so the reveal is NOT gated
on profiling — the model advances on its own once it has enough context.
"""
from __future__ import annotations

from dataclasses import dataclass, field

PHASES = ["greeting", "discovery", "reveal", "config", "booking", "crm"]

# POC: the reveal is locked to this model regardless of profiling.
LOCKED_MODEL = "f-150-lariat"


@dataclass
class SessionState:
    full_name: str | None = None
    profile: dict = field(default_factory=dict)          # profiling insights, if ever persisted
    config: dict = field(default_factory=dict)           # model / exterior_color / wheel / interior
    config_finalized: bool = False                       # display_car_configuration called
    retailer: str | None = None
    booking: dict = field(default_factory=dict)          # date / time / wow moments
    booked: bool = False

    # ---- derived readiness ----
    @property
    def config_complete(self) -> bool:
        return all(self.config.get(k) for k in ("model", "exterior_color", "wheel", "interior"))

    @property
    def phase(self) -> str:
        if not self.full_name:
            return "greeting"
        if not self.config.get("model"):
            return "discovery"
        if not self.config.get("exterior_color"):
            return "reveal"
        if not (self.config_complete and self.config_finalized):
            return "config"
        if not self.booked:
            return "booking"
        return "crm"

    def render_block(self) -> str:
        """The [STATE] block injected each turn. Treated by the model as ground truth."""
        lines = [f"phase={self.phase}"]
        if self.full_name:
            lines.append(f"name={self.full_name}")
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
