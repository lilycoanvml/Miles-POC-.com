"""State machine tests (Miles 3.0, Phase 2). Exercises both flows via the MILES_FLOW flag."""
from app.state import SessionState

V2_PROFILE = {"passenger_count": "2", "driving_environment": "city",
              "daily_car_use": "commute", "weekend_vibe": "chill"}
V3_PROFILE = {"life_mode": "project_home", "daily_use": "work_haul",
              "powertrain_comfort": "hybrid", "passengers": "2"}


def test_v2_phase_progression(monkeypatch):
    monkeypatch.delenv("MILES_FLOW", raising=False)  # default = miles2
    s = SessionState()
    assert s.phase == "greeting"
    s.full_name = "Alex"
    assert s.phase == "lineup"
    s.profile = dict(V2_PROFILE)
    assert s.phase == "reveal"          # profiling complete, no model
    s.config = {"model": "f-150-lariat"}
    assert s.phase == "config"
    assert "budget" not in s.render_block()  # no budget/persona surfaced in v2


def test_v3_phase_progression_inserts_budget(monkeypatch):
    monkeypatch.setenv("MILES_FLOW", "miles3")
    s = SessionState()
    assert s.phase == "greeting"
    s.full_name = "Alex"
    assert s.phase == "discovery"
    s.profile = dict(V3_PROFILE)
    assert s.phase == "budget"          # discovery complete, budget not yet set
    s.budget = {"max": 55000}
    assert s.phase == "reveal"
    s.config = {"model": "f-150-lariat"}
    assert s.phase == "config"


def test_v3_persona_populates_after_discovery(monkeypatch):
    monkeypatch.setenv("MILES_FLOW", "miles3")
    s = SessionState(full_name="Alex", profile=dict(V3_PROFILE))
    s.update_persona()
    assert s.persona.get("dominant") == "build"
    block = s.render_block()
    assert "persona=build" in block


def test_v3_running_total_in_state_block(monkeypatch):
    monkeypatch.setenv("MILES_FLOW", "miles3")
    s = SessionState(full_name="Alex", profile=dict(V3_PROFILE),
                     budget={"max": 70000},
                     config={"model": "f-150-lariat", "wheel": "22-chrome"})
    block = s.render_block()
    assert "running_total=66990" in block  # 62995 + 3995


def test_v2_does_not_populate_persona(monkeypatch):
    monkeypatch.delenv("MILES_FLOW", raising=False)
    s = SessionState(full_name="Alex", profile=dict(V2_PROFILE))
    s.update_persona()
    assert s.persona == {}
