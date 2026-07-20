"""Persona inference (Miles 3.0).

Pure, deterministic, and data-driven: discovery answers are scored against the tunable weights in
`content/personas/<id>/persona.json` to infer one of {build, thrill, adventure}. No vehicle names,
prices, or copy live here — only the scoring math. See docs/AUDIT.md and Miles_3.0_Restructuring.md §3.

`score()` takes already-loaded registries so it stays trivially testable; `load_registries()` reads
the content folder for runtime use.
"""
from __future__ import annotations

import json
from pathlib import Path

CONTENT_DIR = Path(__file__).resolve().parent.parent / "content" / "personas"
PERSONA_IDS = ("build", "thrill", "adventure")

# Below this margin (dominant score's lead over the runner-up, as a fraction of the dominant score)
# the inference is "low confidence" and the flow should ask one tie-breaker before locking.
CONFIDENCE_THRESHOLD = 0.15


def load_registries(content_dir: Path | None = None) -> dict:
    """Load {persona_id: persona.json dict} from the content folder."""
    base = content_dir or CONTENT_DIR
    out: dict = {}
    for pid in PERSONA_IDS:
        path = base / pid / "persona.json"
        if path.exists():
            with path.open(encoding="utf-8") as f:
                out[pid] = json.load(f)
    return out


def score(profile: dict, registries: dict) -> dict:
    """Score a discovery `profile` against persona `registries`.

    profile: {field: answer_value}, e.g. {"life_mode": "project_home", "daily_use": "work_haul"}.
    Returns {"scores": {id: int}, "dominant": id|None, "confidence": float in [0,1]}.
    confidence is the dominant's margin over the runner-up, as a fraction of the dominant score
    (0.0 on a tie or when nothing scores).
    """
    scores: dict = {}
    for pid, reg in registries.items():
        weights = reg.get("scoringWeights", {})
        total = 0
        for field, mapping in weights.items():
            answer = profile.get(field)
            if answer is not None:
                total += mapping.get(answer, 0)
        scores[pid] = total

    if not scores:
        return {"scores": {}, "dominant": None, "confidence": 0.0}

    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    dominant, top = ranked[0]
    second = ranked[1][1] if len(ranked) > 1 else 0
    confidence = round((top - second) / top, 3) if top > 0 else 0.0
    if top <= 0:
        dominant = None
    return {"scores": scores, "dominant": dominant, "confidence": confidence}


def is_confident(result: dict) -> bool:
    """True when the inference is strong enough to lock without a tie-breaker."""
    return bool(result.get("dominant")) and result.get("confidence", 0.0) >= CONFIDENCE_THRESHOLD
