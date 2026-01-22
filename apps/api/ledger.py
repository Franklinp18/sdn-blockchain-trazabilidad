from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, Tuple


def canonical_payload(payload: Dict[str, Any]) -> str:
    # JSON determinista para hashing
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def compute_block_hash(
    prev_hash: str,
    ts_iso: str,
    actor: str,
    action: str,
    tx_id: str,
    payload_json: str,
) -> str:
    msg = f"{prev_hash}|{ts_iso}|{actor}|{action}|{tx_id}|{payload_json}"
    return hashlib.sha256(msg.encode("utf-8")).hexdigest()


def make_tx_id(prefix: str, numeric_id: int) -> str:
    return f"{prefix}_{numeric_id:06d}"


def normalize_hash(s: str) -> str:
    return (s or "").strip()


def is_sha256_hex(s: str) -> bool:
    s = normalize_hash(s)
    if len(s) != 64:
        return False
    try:
        int(s, 16)
        return True
    except ValueError:
        return False

