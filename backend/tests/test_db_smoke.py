import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


@pytest.mark.asyncio
async def test_sqlite_engine_roundtrip(tmp_path) -> None:
    """Smoke test: async SQLAlchemy engine works against SQLite."""
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'smoke.db'}")

    async with engine.begin() as conn:
        await conn.execute(text("CREATE TABLE t (id INTEGER PRIMARY KEY)"))
        await conn.execute(text("INSERT INTO t (id) VALUES (1)"))
        result = await conn.execute(text("SELECT id FROM t"))
        assert result.scalar_one() == 1

    await engine.dispose()
