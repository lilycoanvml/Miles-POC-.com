"""Persona inference tests (Miles 3.0, Phase 1). Uses the real content/personas weights."""
from app import persona

REG = persona.load_registries()


def test_registries_load():
    assert set(REG) == {"build", "thrill", "adventure"}


def test_build_profile_dominant_and_confident():
    r = persona.score({"life_mode": "project_home", "daily_use": "work_haul"}, REG)
    assert r["dominant"] == "build"
    assert r["confidence"] >= persona.CONFIDENCE_THRESHOLD
    assert persona.is_confident(r)


def test_adventure_profile():
    r = persona.score({"life_mode": "trails_camp", "daily_use": "family"}, REG)
    assert r["dominant"] == "adventure"


def test_thrill_profile():
    r = persona.score({"life_mode": "the_drive", "daily_use": "play"}, REG)
    assert r["dominant"] == "thrill"


def test_low_confidence_tie_triggers_tiebreaker():
    # life_mode=project_home (Build+3) vs daily_use=play (Thrill+3) → tie → confidence 0.
    r = persona.score({"life_mode": "project_home", "daily_use": "play"}, REG)
    assert r["confidence"] < persona.CONFIDENCE_THRESHOLD
    assert persona.is_confident(r) is False


def test_empty_profile_has_no_dominant():
    r = persona.score({}, REG)
    assert r["dominant"] is None
    assert r["confidence"] == 0.0
