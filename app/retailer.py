"""Real retailer lookup via Google Places API (Text Search).

find_nearest(location) calls places:searchText for the nearest Ford dealership and returns
structured name/address/phone. Falls back to a generated placeholder on any failure, so the
booking flow never hard-fails in the POC. Uses stdlib urllib — no extra dependency.

Auth: set GOOGLE_MAPS_API_KEY (a Maps Platform key with the Places API enabled).
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
FIELD_MASK = "places.displayName,places.formattedAddress,places.nationalPhoneNumber"
TIMEOUT_S = 8


def _api_key() -> str | None:
    return os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("GOOGLE_PLACES_API_KEY")


def _text_search(location: str, api_key: str) -> dict:
    body = json.dumps({
        "textQuery": f"Ford dealership near {location}",
        "maxResultCount": 1,
    }).encode("utf-8")
    req = urllib.request.Request(
        PLACES_URL,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": FIELD_MASK,
        },
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:  # noqa: S310 - fixed Google host
        return json.loads(resp.read().decode("utf-8"))


def find_nearest(location: str) -> dict:
    """Return {retailer, address, phone, source}. Never raises — falls back on any failure."""
    location = location.strip()
    api_key = _api_key()
    if api_key:
        try:
            data = _text_search(location, api_key)
            places = data.get("places") or []
            if places:
                p = places[0]
                name = (p.get("displayName") or {}).get("text")
                if name:
                    return {
                        "retailer": name,
                        "address": p.get("formattedAddress", ""),
                        "phone": p.get("nationalPhoneNumber", ""),
                        "source": "google_places",
                    }
        except (urllib.error.URLError, ValueError, KeyError, TimeoutError):
            pass  # degrade gracefully in the POC
    return {
        "retailer": f"Ford {location.title()} Central",
        "address": location.title(),
        "phone": "",
        "source": "fallback",
    }
