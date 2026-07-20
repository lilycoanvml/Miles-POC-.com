"""Phase 6 tests: analytics events + booking handoff integrity."""
import json

import pytest

from app import analytics, tools
from app.state import SessionState

V3_PROFILE = {"life_mode": "project_home", "daily_use": "work_haul", "powertrain_comfort": "hybrid", "passengers": "2"}
MEM = {"profiling": {}}


@pytest.fixture
def events():
    captured: list = []
    analytics.subscribe(captured.append)
    yield captured
    analytics.reset()


def _built(monkeypatch):
    """A miles3 state past discovery + budget with a full F-150 config."""
    monkeypatch.setenv("MILES_FLOW", "miles3")
    s = SessionState(full_name="Alex", profile=dict(V3_PROFILE), budget={"max": 70000})
    s.update_persona()
    s.config = {"model": "f-150-lariat", "exterior_color": "oxford-white",
                "wheel": "20-gloss-black", "interior": "activex-black"}
    return s


def test_persona_locked_emitted(events, monkeypatch):
    monkeypatch.setenv("MILES_FLOW", "miles3")
    s = SessionState(full_name="Alex", profile=dict(V3_PROFILE))
    s.update_persona()
    s.update_persona()  # second call must NOT re-emit
    locks = [e for e in events if e["event"] == "persona_locked"]
    assert len(locks) == 1
    assert locks[0]["dominant"] == "build"


def test_budget_captured_emitted(events, monkeypatch):
    monkeypatch.setenv("MILES_FLOW", "miles3")
    s = SessionState(full_name="Alex", profile=dict(V3_PROFILE))
    tools.execute("set_budget", {"max": 55000, "monthly": 700}, s, MEM)
    assert any(e["event"] == "budget_captured" and e["max"] == 55000 for e in events)


def test_option_changed_emitted(events, monkeypatch):
    s = _built(monkeypatch)
    tools.execute("select_wheel", {"model": "f-150-lariat", "wheel": "22-chrome"}, s, MEM)
    ev = [e for e in events if e["event"] == "option_changed"]
    assert ev and ev[-1]["category"] == "wheel" and ev[-1]["price"] == 3995


def test_summary_shown_emitted_with_in_budget(events, monkeypatch):
    s = _built(monkeypatch)
    tools.execute("display_car_configuration", {}, s, MEM)
    summ = [e for e in events if e["event"] == "summary_shown"]
    assert summ and summ[0]["in_budget"] is True and summ[0]["persona"] == "build"


def test_booking_handoff_carries_full_build(events, monkeypatch):
    s = _built(monkeypatch)
    s.config_finalized = True
    s.retailer = "Ford Austin Central"
    result, is_error = tools.execute(
        "book_test_drive",
        {"retailer": "Ford Austin Central", "date": "2026-08-14", "time": "14:30",
         "full_name": "Alex Kim", "email": "alex@example.com"},
        s, MEM,
    )
    assert not is_error
    payload = json.loads(result)
    # Nothing resets — the full build + price + persona ride along.
    assert payload["config"]["model"] == "f-150-lariat"
    assert payload["running_total"] == 62995 + 1595  # base + 20-gloss-black
    assert payload["persona"] == "build"
    assert payload["budget"] == {"max": 70000}
    assert any(e["event"] == "booking_submitted" for e in events)
