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
