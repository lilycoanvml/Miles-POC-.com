"""Knowledge base loader + lookup helpers for the two-tier car catalog."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KB_PATH = ROOT / "car_configurations.json"


@lru_cache(maxsize=1)
def load_kb() -> dict:
    with KB_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def lineup() -> list[dict]:
    return load_kb()["lineup"]


def model(model_id: str) -> dict | None:
    return load_kb().get("models", {}).get(model_id)


def color_ids(model_id: str) -> list[str]:
    m = model(model_id)
    return [c["id"] for c in m["exterior_colors"]] if m else []


def wheel_ids(model_id: str) -> list[str]:
    m = model(model_id)
    return [w["id"] for w in m["wheels"]] if m else []


def interior_ids(model_id: str) -> list[str]:
    m = model(model_id)
    return [i["id"] for i in m["interiors"]] if m else []


def _find(items: list[dict], item_id: str) -> dict | None:
    return next((x for x in items if x["id"] == item_id), None)


def color(model_id: str, color_id: str) -> dict | None:
    m = model(model_id)
    return _find(m["exterior_colors"], color_id) if m else None


def wheel(model_id: str, wheel_id: str) -> dict | None:
    m = model(model_id)
    return _find(m["wheels"], wheel_id) if m else None


def interior(model_id: str, interior_id: str) -> dict | None:
    m = model(model_id)
    return _find(m["interiors"], interior_id) if m else None


# --------------------------------------------------------------------------- Miles 3.0: persona + budget

# Maps in-session config keys (state.config) to their catalog option-list keys.
CATEGORY_KEYS = {
    "exterior_color": "exterior_colors",
    "wheel": "wheels",
    "interior": "interiors",
}


def has_tier2(model_id: str) -> bool:
    """True when the vehicle has a full buildable (Tier-2) tree — only the F-150 today."""
    return model(model_id) is not None


def base_price(model_id: str) -> int:
    """The buildable trim's starting MSRP (Tier-2), or 0 if the vehicle has no build tree."""
    m = model(model_id)
    if not m:
        return 0
    trims = m.get("trims") or []
    return trims[0].get("starting_price_usd", 0) if trims else 0


def option_price(model_id: str, category: str, option_id: str) -> int:
    """Price delta for a single option. `category` may be a config key (exterior_color) or a
    catalog key (exterior_colors). Returns 0 if the model/option is unknown."""
    m = model(model_id)
    if not m or not option_id:
        return 0
    kb_key = CATEGORY_KEYS.get(category, category)
    return (_find(m.get(kb_key, []), option_id) or {}).get("price", 0)


def lineup_by_persona(persona_id: str, max_price: int | None = None) -> list[dict]:
    """Rank the Tier-1 lineup for a persona (highest personaTag first; buildable vehicles win ties).
    When `max_price` is given, prefer only vehicles at/under it — but never drop to an empty list, so
    if nothing fits, the full ranking is returned (the caller surfaces an honest over-budget note)."""
    items = lineup()
    ranked = sorted(
        items,
        key=lambda v: (v.get("personaTags", {}).get(persona_id, 0), has_tier2(v["id"])),
        reverse=True,
    )
    if max_price is None:
        return ranked
    affordable = [v for v in ranked if v.get("price", 0) <= max_price]
    return affordable or ranked
