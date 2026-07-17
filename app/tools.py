"""Tool schemas + handlers.

Each handler validates its arguments against the knowledge base and mutates SessionState.
Phase/readiness gating is enforced here: a tool called out of turn returns an error string so
the model recovers gracefully (talks instead of acting). select_*/display_* return a
{state, stub} payload — `stub` is the seam the future UI renders.
"""
from __future__ import annotations

import json
from pathlib import Path

from . import kb, memory
from .state import LOCKED_MODEL, SessionState

ROOT = Path(__file__).resolve().parent.parent


def load_tool_schemas() -> list[dict]:
    with (ROOT / "tools.json").open(encoding="utf-8") as f:
        return json.load(f)["tools"]


def _err(msg: str) -> tuple[str, bool]:
    return msg, True


def _ok(payload: dict) -> tuple[str, bool]:
    return json.dumps(payload), False


# --------------------------------------------------------------------------- gating

def gate(name: str, state: SessionState) -> str | None:
    """Return an error message if the tool isn't legal yet, else None."""
    if name == "focus_lineup_model" and not state.lineup_shown:
        return "Introduce the lineup with show_lineup before focusing a specific vehicle."
    if name in ("select_exterior_color", "select_wheel", "select_interior") and not state.config.get("model"):
        return "No model selected yet — reveal the model first before configuring."
    if name == "select_wheel" and not state.config.get("exterior_color"):
        return "Pick an exterior colour before wheels."
    if name == "select_interior" and not state.config.get("wheel"):
        return "Pick wheels before the interior."
    if name == "display_car_configuration" and not state.config_complete:
        return "Configuration incomplete — need model, exterior colour, wheel and interior first."
    if name in ("set_car_view", "animate_car") and not state.config.get("model"):
        return "No model selected yet — reveal the model before driving the 3D view."
    if name == "find_retailer" and not state.config_finalized:
        return "Finalise the configuration before searching for a retailer."
    if name == "book_test_drive" and not state.retailer:
        return "Find the nearest retailer before booking."
    return None


# --------------------------------------------------------------------------- handlers

def h_save_user_insight(state, mem, inp):
    cat, val = inp["category"], inp["value"]
    memory.set_insight(mem, cat, val)
    if cat == "full_name":
        state.full_name = val
    elif cat in ("passenger_count", "driving_environment", "daily_car_use", "weekend_vibe"):
        state.profile[cat] = val
    return _ok({"saved": True, "category": cat})


def h_show_lineup(state, mem, inp):
    state.lineup_shown = True
    return _ok({"stub": "lineup_carousel", "models": kb.lineup()})


def h_focus_lineup_model(state, mem, inp):
    model_id = inp["model"]
    ids = [m["id"] for m in kb.lineup()]
    if model_id not in ids:
        return _err(f"Unknown lineup vehicle '{model_id}'. Options: {ids}")
    state.lineup_focus = model_id
    return _ok({"stub": "lineup_focus", "model": model_id})


def h_select_model(state, mem, inp):
    model_id = inp["model"]
    if model_id != LOCKED_MODEL:
        return _err(f"POC reveal is locked to the F-150 Lariat ('{LOCKED_MODEL}'). Reveal that model.")
    m = kb.model(model_id)
    if not m:
        return _err(f"Unknown model '{model_id}'.")
    state.config = {"model": model_id}  # reset config on (re)select
    state.config_finalized = False
    return _ok({"stub": "model_silhouette", "model": {
        "id": m["id"], "name": m["name"], "segment": m["segment"],
        "powertrain": m["powertrain"], "features": m["features"],
    }})


def h_select_exterior_color(state, mem, inp):
    model_id, color_id = inp["model"], inp["color"]
    c = kb.color(model_id, color_id)
    if not c:
        return _err(f"'{color_id}' isn't available on this model. Options: {kb.color_ids(model_id)}")
    state.config["exterior_color"] = color_id
    return _ok({"stub": "exterior_render", "color": c})


def h_select_wheel(state, mem, inp):
    model_id, wheel_id = inp["model"], inp["wheel"]
    w = kb.wheel(model_id, wheel_id)
    if not w:
        return _err(f"'{wheel_id}' isn't a valid wheel for this model. Options: {kb.wheel_ids(model_id)}")
    state.config["wheel"] = wheel_id
    return _ok({"stub": "wheel_silhouette", "wheel": w})


def h_select_interior(state, mem, inp):
    model_id, interior_id = inp["model"], inp["interior"]
    i = kb.interior(model_id, interior_id)
    if not i:
        return _err(f"'{interior_id}' isn't a valid interior for this model. Options: {kb.interior_ids(model_id)}")
    state.config["interior"] = interior_id
    return _ok({"stub": "interior_upholstery", "interior": i})


def h_display_car_configuration(state, mem, inp):
    state.config_finalized = True
    m = kb.model(state.config["model"])
    full = {
        "model": m["name"],
        "exterior_color": kb.color(state.config["model"], state.config["exterior_color"]),
        "wheel": kb.wheel(state.config["model"], state.config["wheel"]),
        "interior": kb.interior(state.config["model"], state.config["interior"]),
    }
    memory.set_insight(mem, "car_config", json.dumps({k: state.config[k] for k in state.config}))
    return _ok({"stub": "full_carousel", "configuration": full})


def h_find_retailer(state, mem, inp):
    location = inp["location"].strip()
    # Real lookup via server-side web search (falls back to a placeholder on failure).
    from . import retailer  # lazy: keeps the deterministic layer importable without the SDK
    result = retailer.find_nearest(location)
    state.retailer = result["retailer"]
    memory.set_insight(mem, "location", location)
    return _ok(result)


def h_book_test_drive(state, mem, inp):
    state.booking = {
        "date": inp["date"], "time": inp["time"],
        "wow_moments": inp.get("wow_moments", {}),
    }
    state.booked = True
    appt = {"retailer": inp["retailer"], "date": inp["date"], "time": inp["time"]}
    memory.set_insight(mem, "test_drive_appointment", json.dumps(appt))
    memory.set_insight(mem, "full_name", inp["full_name"])
    memory.set_insight(mem, "email", inp["email"])
    # Faked booking: always "available" in the POC; no real scheduling occurs.
    return _ok({"confirmed": True, "mock": True, **appt})


def h_set_car_view(state, mem, inp):
    return _ok({"stub": "camera_view", "view": inp["view"]})


def h_animate_car(state, mem, inp):
    return _ok({"stub": "rig_action", "action": inp["action"]})


HANDLERS = {
    "save_user_insight": h_save_user_insight,
    "show_lineup": h_show_lineup,
    "focus_lineup_model": h_focus_lineup_model,
    "select_model": h_select_model,
    "select_exterior_color": h_select_exterior_color,
    "select_wheel": h_select_wheel,
    "select_interior": h_select_interior,
    "display_car_configuration": h_display_car_configuration,
    "set_car_view": h_set_car_view,
    "animate_car": h_animate_car,
    "find_retailer": h_find_retailer,
    "book_test_drive": h_book_test_drive,
}


def execute(name: str, inp: dict, state: SessionState, mem: dict) -> tuple[str, bool]:
    blocked = gate(name, state)
    if blocked:
        return _err(blocked)
    handler = HANDLERS.get(name)
    if not handler:
        return _err(f"Unknown tool '{name}'.")
    try:
        return handler(state, mem, inp)
    except Exception as exc:  # noqa: BLE001 - surface to model as a recoverable error
        return _err(f"Tool '{name}' failed: {exc}")
