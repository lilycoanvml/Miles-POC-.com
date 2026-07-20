"""Phase 4 tests: persona-matched recommendation + unlocked reveal."""
from app import persona, tools
from app.state import SessionState

BUILD = {"life_mode": "project_home", "daily_use": "work_haul", "powertrain_comfort": "hybrid", "passengers": "2"}
ADVENTURE = {"life_mode": "trails_camp", "daily_use": "family", "powertrain_comfort": "gas", "passengers": "4"}
MEM = {"profiling": {}}


def _locked(profile, budget=None):
    # Score persona directly (recommend() itself is flow-agnostic; only update_persona gates on the flag).
    s = SessionState(full_name="Alex", profile=dict(profile), budget=budget or {"max": 70000})
    s.persona = persona.score(s.profile, persona.load_registries())
    return s


def test_recommend_none_before_persona():
    assert persona.recommend(SessionState()) is None


def test_recommend_build_is_f150():
    assert persona.recommend(_locked(BUILD)) == "f-150-lariat"


def test_recommend_adventure_is_ranger():
    assert persona.recommend(_locked(ADVENTURE)) == "ranger"


def test_recommend_respects_budget_ceiling():
    # Adventure hero is Ranger (33550); with a 30k ceiling only Maverick (28145) fits.
    s = _locked(ADVENTURE, budget={"max": 30000})
    rec = persona.recommend(s)
    from app import kb
    price = next(v["price"] for v in kb.lineup() if v["id"] == rec)
    assert price <= 30000


def test_select_model_miles3_reveals_ranger_but_builds_f150(monkeypatch):
    monkeypatch.setenv("MILES_FLOW", "miles3")
    s = _locked(ADVENTURE)
    result, is_error = tools.execute("select_model", {"model": "ranger"}, s, MEM)
    assert not is_error
    import json
    payload = json.loads(result)
    assert payload["revealed"] == "ranger"
    assert payload["build_model"] == "f-150-lariat"
    assert payload["build_deferred"] is True
    assert s.revealed_model == "ranger"
    assert s.config["model"] == "f-150-lariat"   # deep-build target
    assert s.phase == "config"


def test_select_model_miles3_f150_builds_itself(monkeypatch):
    monkeypatch.setenv("MILES_FLOW", "miles3")
    s = _locked(BUILD)
    result, is_error = tools.execute("select_model", {"model": "f-150-lariat"}, s, MEM)
    import json
    payload = json.loads(result)
    assert payload["build_deferred"] is False
    assert s.config["model"] == "f-150-lariat"


def test_select_model_miles2_still_locked(monkeypatch):
    monkeypatch.delenv("MILES_FLOW", raising=False)
    s = SessionState(full_name="Alex")
    result, is_error = tools.execute("select_model", {"model": "ranger"}, s, MEM)
    assert is_error and "locked" in result.lower()


def test_state_block_surfaces_recommended(monkeypatch):
    monkeypatch.setenv("MILES_FLOW", "miles3")
    s = _locked(ADVENTURE)  # budget set, no model → reveal phase
    assert "recommended=ranger" in s.render_block()
