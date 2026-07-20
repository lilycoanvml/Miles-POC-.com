"""Feature flags (Miles 3.0).

MILES_FLOW selects the conversational flow: "miles2" (default, the shipped POC) or "miles3"
(persona-driven, budget-anchored). Read at call time so tests and per-deploy env can toggle it.
"""
from __future__ import annotations

import os


def flow() -> str:
    return os.environ.get("MILES_FLOW", "miles2").lower()


def is_miles3() -> bool:
    return flow() == "miles3"
