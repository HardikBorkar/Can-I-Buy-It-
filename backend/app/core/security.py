import hashlib
import json
import uuid
from typing import Any, Dict


# Stable deterministic namespace for UUIDv5 generation
GUARDIAN_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_DNS, "guardian.copilot.paypal.internal")


def canonical_json(data: Any) -> str:
    """Produces sorted, deterministic JSON string for consistent hashing."""
    return json.dumps(data, sort_keys=True, separators=(",", ":"), default=str)


def generate_idempotency_key(payload: Dict[str, Any], prefix: str = "") -> str:
    """
    Generates a deterministic UUIDv5 idempotency key based on canonical payload representation.
    Ensures safe retries without duplicate executions against PayPal REST v2.
    """
    canon = canonical_json(payload)
    gen_uuid = str(uuid.uuid5(GUARDIAN_NAMESPACE, canon))
    if prefix:
        return f"{prefix}-{gen_uuid}"
    return gen_uuid


def hash_payload(data: Any) -> str:
    """Computes SHA-256 digest of payload for tamper detection."""
    canon = canonical_json(data)
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()

