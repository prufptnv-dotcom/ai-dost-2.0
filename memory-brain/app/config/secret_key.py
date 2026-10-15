"""Single source of truth for JWT signing secrets (#180).

Replaces the hard-coded, forgeable fallbacks that lived in three places:
  - app/auth/auth.py:13        ("ai_dost_secret_key")
  - app/config/security.py:10  ("ai_dost_super_secret_jwt_key_2026")
  - app/api/auth.py:16         (same fallback again)

Resolution order:
  1. SECRET_KEY env        — documented in .env.example, loaded from memory-brain/.env
  2. JWT_SECRET_KEY env    — legacy name, still honoured for compatibility
  3. ephemeral per-process key — dev fallback; never a static guessable value,
     but note JWTs invalidate when the process restarts.

All sign AND verify call sites must import get_secret_key() from here so a
single env var controls both halves of the JWT lifecycle.
"""

import os
import secrets
import warnings

try:
    from dotenv import load_dotenv

    # Honour memory-brain/.env even when the process was started without it
    # (does NOT override variables already present in the environment).
    load_dotenv()
except Exception:  # pragma: no cover - dotenv optional at import time
    pass

_GENERATED = None


def get_secret_key() -> str:
    """Return the active JWT signing secret (env-driven, no static fallback)."""
    global _GENERATED
    for env_name in ("SECRET_KEY", "JWT_SECRET_KEY"):
        value = (os.getenv(env_name) or "").strip()
        if value:
            return value
    if _GENERATED is None:
        _GENERATED = secrets.token_urlsafe(48)
        warnings.warn(
            "SECRET_KEY is not set — using an ephemeral key; all JWTs will be "
            "invalidated on restart. Set SECRET_KEY in memory-brain/.env "
            "(see .env.example) for production.",
            stacklevel=2,
        )
    return _GENERATED
