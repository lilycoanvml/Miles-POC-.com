"""Budget math (Miles 3.0).

Pure helpers over a `SessionState`-like object (needs `.config`, optionally `.budget`) and the
loaded catalog. No copy, no vehicle names — just the running total and the in-budget invariant that
Phase 5 enforces before any recommendation or summary is shown. See Miles_3.0_Restructuring.md §7.

Prices come from the catalog: the trim's `starting_price_usd` (base) plus per-option `price` deltas.
"""
from __future__ import annotations

from . import kb

# Config keys that carry a priced option, in build order.
OPTION_CATEGORIES = ("exterior_color", "wheel", "interior")


def option_delta(catalog_model_id: str, category: str, option_id: str) -> int:
    """Price delta for one option (thin wrapper over kb.option_price)."""
    return kb.option_price(catalog_model_id, category, option_id)


def running_total(state) -> int:
    """Base trim MSRP + the deltas of every option currently selected in state.config."""
    config = getattr(state, "config", {}) or {}
    model_id = config.get("model")
    if not model_id:
        return 0
    total = kb.base_price(model_id)
    for category in OPTION_CATEGORIES:
        total += kb.option_price(model_id, category, config.get(category))
    return total


def in_budget(state) -> bool:
    """True when the running total fits under budget.max (or no max is set)."""
    budget = getattr(state, "budget", {}) or {}
    ceiling = budget.get("max")
    if not ceiling:
        return True
    return running_total(state) <= ceiling


def over_by(state) -> int:
    """How far the running total exceeds budget.max (0 when in budget or no max)."""
    budget = getattr(state, "budget", {}) or {}
    ceiling = budget.get("max")
    if not ceiling:
        return 0
    return max(0, running_total(state) - ceiling)
