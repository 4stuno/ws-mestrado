"""Cache em memória para sequências pré-processadas."""
from __future__ import annotations

import hashlib
import json
import threading
from typing import Any

_lock = threading.Lock()
_sequences_cache: dict[str, list[dict]] = {}
_activity_cache: dict[str, Any] = {}


def _key(prefix: str, payload: dict) -> str:
    raw = json.dumps(payload, sort_keys=True, default=str)
    return f"{prefix}:{hashlib.sha256(raw.encode()).hexdigest()[:16]}"


def get_sequences(key: str) -> list[dict] | None:
    with _lock:
        return _sequences_cache.get(key)


def set_sequences(key: str, data: list[dict]) -> None:
    with _lock:
        _sequences_cache[key] = data


def get_activity(key: str):
    with _lock:
        return _activity_cache.get(key)


def set_activity(key: str, df) -> None:
    with _lock:
        _activity_cache[key] = df


def sequences_cache_key(params: dict) -> str:
    return _key(
        "seq",
        {
            "assignment_id": params.get("assignment_id"),
            "t_start": params.get("initial_date"),
            "t_end": params.get("final_date"),
            "multilevel": params.get("multilevel"),
            "coalescing_repeating": params.get("coalescing_repeating"),
            "coalescing_hidden": params.get("coalescing_hidden"),
            "spell": params.get("spell"),
            "tf": params.get("tf"),
        },
    )
