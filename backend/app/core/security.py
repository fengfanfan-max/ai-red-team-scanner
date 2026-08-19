"""Password hashing & JWT helpers.

Both bcrypt and JWT work are CPU-ish / blocking, so callers MUST run them
through `run_in_threadpool` inside async handlers (async red line, ADR-0003).
"""

from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi.concurrency import run_in_threadpool

from app.core.config import Settings

TOKEN_TYPE = "bearer"


def _jwt_secret(settings: Settings) -> str:
    return settings.jwt_secret


async def hash_password(password: str) -> str:
    """Async wrapper: bcrypt hashing offloads to a worker thread."""

    def _hash() -> str:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    return await run_in_threadpool(_hash)


async def verify_password(password: str, password_hash: str) -> bool:
    def _verify() -> bool:
        try:
            return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
        except ValueError:
            return False

    return await run_in_threadpool(_verify)


async def create_access_token(user_id: int, settings: Settings) -> str:
    """Sign a JWT; returns the token string (creation is cheap, kept sync-ish
    via threadpool for consistency)."""

    def _create() -> str:
        now = datetime.now(UTC)
        payload = {
            "sub": str(user_id),
            "iat": now,
            "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
        }
        return jwt.encode(payload, _jwt_secret(settings), algorithm=settings.jwt_algorithm)

    return await run_in_threadpool(_create)


def decode_token(token: str, settings: Settings) -> int | None:
    """Return the user id encoded in the token, or None when invalid/expired."""
    try:
        payload = jwt.decode(token, _jwt_secret(settings), algorithms=[settings.jwt_algorithm])
        return int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        return None
