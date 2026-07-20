"""Lightweight analytics for Miles 3.0.

Emits structured JSON log lines (prefixed `ANALYTICS `) so a real sink can be attached later by
tailing Cloud Run logs — no external dependency in the POC. A subscribe() hook lets tests capture
events. Covers the strategy §9 metrics: phase drop-off, budget capture, persona distribution +
confidence, option changes, in-budget summary, booking.
"""
from __future__ import annotations

import json

_subscribers: list = []


def subscribe(fn) -> None:
    """Register a callback(record: dict) — used by tests to capture emitted events."""
    _subscribers.append(fn)


def reset() -> None:
    _subscribers.clear()


def emit(event: str, **fields) -> dict:
    record = {"event": event, **fields}
    print("ANALYTICS " + json.dumps(record, ensure_ascii=False), flush=True)
    for fn in list(_subscribers):
        try:
            fn(record)
        except Exception:  # noqa: BLE001 - analytics must never break the conversation
            pass
    return record
