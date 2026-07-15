"""Cross-session memory: a flat JSON file loaded at session start, written by save_user_insight.

Separate from the in-session SessionState. This is what populates the USER_CONTEXT block
in the system prompt at the start of each session.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Override with MILES_MEMORY_PATH on Cloud Run (e.g. /tmp/...); the app dir may be read-only.
# For real cross-instance persistence, back this with Firestore/GCS instead of a local file.
MEMORY_PATH = Path(os.environ.get("MILES_MEMORY_PATH") or (ROOT / "miles_memory.json"))

# Categories that live as top-level user facts vs. nested profiling insights.
PROFILING_KEYS = {"passenger_count", "driving_environment", "daily_car_use", "weekend_vibe"}
TOP_LEVEL_KEYS = {
    "full_name", "email", "location", "height_cm",
    "test_drive_preferences", "car_config", "test_drive_appointment",
}


def load() -> dict:
    if MEMORY_PATH.exists():
        with MEMORY_PATH.open(encoding="utf-8") as f:
            return json.load(f)
    return {"profiling": {}}


def save(mem: dict) -> None:
    with MEMORY_PATH.open("w", encoding="utf-8") as f:
        json.dump(mem, f, indent=2, ensure_ascii=False)


def set_insight(mem: dict, category: str, value: str) -> None:
    if category in PROFILING_KEYS:
        mem.setdefault("profiling", {})[category] = value
    else:
        mem[category] = value
    save(mem)


def context_value(mem: dict, key: str) -> str:
    """Render a USER_CONTEXT field, returning a friendly placeholder when unknown."""
    if key == "profiling":
        prof = mem.get("profiling") or {}
        return ", ".join(f"{k}={v}" for k, v in prof.items()) if prof else "(none yet)"
    val = mem.get(key)
    return str(val) if val else "(not yet known)"
