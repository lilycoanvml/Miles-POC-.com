"""Phase 3 tests: set_budget tool gating + miles3 system-prompt assembly."""
from app import tools
from app.state import SessionState

V3_PROFILE = {"life_mode": "project_home", "daily_use": "work_haul",
              "powertrain_comfort": "hybrid", "passengers": "2"}
MEM = {"profiling": {}}


def _discovered() -> SessionState:
    return SessionState(full_name="Alex", profile=dict(V3_PROFILE))


def test_set_budget_blocked_in_v2(monkeypatch):
    monkeypatch.delenv("MILES_FLOW", raising=False)
    result, is_error = tools.execute("set_budget", {"max": 55000}, _discovered(), MEM)
    assert is_error and "miles3" in result


def test_set_budget_blocked_before_discovery(monkeypatch):
    monkeypatch.setenv("MILES_FLOW", "miles3")
    result, is_error = tools.execute("set_budget", {"max": 55000}, SessionState(full_name="Alex"), MEM)
    assert is_error and "discovery" in result.lower()


def test_set_budget_sets_state_and_advances_phase(monkeypatch):
    monkeypatch.setenv("MILES_FLOW", "miles3")
    s = _discovered()
    assert s.phase == "budget"
    result, is_error = tools.execute("set_budget", {"max": 55000, "monthly": 700}, s, MEM)
    assert not is_error
    assert s.budget == {"max": 55000, "monthly": 700}
    assert s.budget_set
    assert s.phase == "reveal"


def test_v3_prompt_appended_when_flagged(monkeypatch):
    monkeypatch.setenv("MILES_FLOW", "miles3")
    from app import agent
    text = agent._render_system_prompt(dict(MEM), "2026-07-20T00:00:00Z")
    assert "MILES 3.0 FLOW (ACTIVE)" in text
    assert "set_budget" in text


def test_v2_prompt_not_appended(monkeypatch):
    monkeypatch.delenv("MILES_FLOW", raising=False)
    from app import agent
    text = agent._render_system_prompt(dict(MEM), "2026-07-20T00:00:00Z")
    assert "MILES 3.0 FLOW (ACTIVE)" not in text


def test_persona_tone_file_loads():
    from app import agent
    tone = agent._load_persona_tone("build")
    assert "BUILD" in tone and len(tone) > 50
