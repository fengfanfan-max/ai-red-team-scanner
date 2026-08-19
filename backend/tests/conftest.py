"""Pytest bootstrap.

The test suite runs against an isolated database — SQLite by default, or any
SQLAlchemy URL via TEST_DATABASE_URL (CI runs the Postgres dialect job, see
ADR-0002). The env var must be set BEFORE `app` modules are imported, hence
the module-level assignment + E402 noqa below.
"""

import os

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
TEST_DB_PATH = os.path.join(os.path.dirname(__file__), ".test-data.db")
if not TEST_DATABASE_URL:
    TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_PATH}"
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

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
    if TEST_DATABASE_URL.startswith("sqlite"):
        _reset_test_db()
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    yield
    if TEST_DATABASE_URL.startswith("sqlite"):
        _reset_test_db()
