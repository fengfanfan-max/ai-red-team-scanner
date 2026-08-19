"""Pytest bootstrap.

The test suite runs against an isolated SQLite file (never the dev database).
The DATABASE_URL env var must be set BEFORE `app` modules are imported, hence
the module-level assignment + E402 noqa below.
"""

import os

TEST_DB_PATH = os.path.join(os.path.dirname(__file__), ".test-data.db")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB_PATH}"

import pytest  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402

from app.core.db import Base  # noqa: E402


def _reset_test_db() -> None:
    """Sync helper so async fixtures don't touch os.path directly (ASYNC240)."""
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)


@pytest.fixture(scope="session", autouse=True)
async def _db_schema():
    """Create the schema once per session; each test uses distinct emails so
    no cross-test coupling is needed."""
    _reset_test_db()
    engine = create_async_engine(f"sqlite+aiosqlite:///{TEST_DB_PATH}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    yield
    _reset_test_db()
