"""Budget + persona-lineup tests (Miles 3.0, Phase 1). Uses the real enriched catalog."""
from types import SimpleNamespace

from app import budget, kb

BASE = 62995  # F-150 Lariat trim starting MSRP


def S(config, budget_=None):
    return SimpleNamespace(config=config, budget=budget_ or {})


def test_base_price():
    assert kb.base_price("f-150-lariat") == BASE


def test_running_total_base_only():
    assert budget.running_total(S({"model": "f-150-lariat"})) == BASE


def test_running_total_sums_option_deltas():
    s = S({"model": "f-150-lariat", "exterior_color": "star-white",
           "wheel": "22-chrome", "interior": "activex-black"})
    # star-white 795 + 22-chrome 3995 + activex-black 0
    assert budget.running_total(s) == BASE + 795 + 3995 + 0


def test_running_total_no_model_is_zero():
    assert budget.running_total(S({})) == 0


def test_in_budget_true_when_under_max():
    assert budget.in_budget(S({"model": "f-150-lariat"}, {"max": 70000})) is True


def test_in_budget_false_and_over_by_when_exceeded():
    s = S({"model": "f-150-lariat", "wheel": "22-chrome"}, {"max": 63000})
    assert budget.in_budget(s) is False
    assert budget.over_by(s) == BASE + 3995 - 63000


def test_in_budget_true_when_no_ceiling():
    assert budget.in_budget(S({"model": "f-150-lariat", "wheel": "22-chrome"})) is True


def test_lineup_by_persona_adventure_hero_is_ranger():
    assert kb.lineup_by_persona("adventure")[0]["id"] == "ranger"


def test_lineup_by_persona_build_hero_is_buildable_f150():
    # F-150 wins the Build tie because it has a Tier-2 build tree.
    assert kb.lineup_by_persona("build", max_price=45000)[0]["id"] == "f-150-lariat"


def test_lineup_by_persona_never_returns_over_budget_hero_when_affordable_exists():
    max_price = 35000  # excludes F-150 (39585) but Maverick (28145) & Ranger (33550) fit
    ranked = kb.lineup_by_persona("build", max_price=max_price)
    assert any(v["price"] <= max_price for v in kb.lineup())  # an in-budget option exists
    assert ranked[0]["price"] <= max_price                    # so the hero must be in budget


def test_lineup_by_persona_falls_back_when_nothing_affordable():
    ranked = kb.lineup_by_persona("build", max_price=1000)  # nothing fits
    assert ranked  # never empty — caller surfaces an honest over-budget note
