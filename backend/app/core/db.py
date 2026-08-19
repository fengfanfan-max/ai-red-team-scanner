from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_url, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


if settings.database_url.startswith("sqlite"):
    # Concurrent writers: the scan engine commits per case while the API
    # reads progress — SQLite needs WAL + a busy timeout to cope (ADR-0002).
    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _connection_record) -> None:  # noqa: ANN001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()


class Base(DeclarativeBase):
    """Declarative base for all ORM models (created in later milestones)."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yield a session per request."""
    async with SessionLocal() as session:
        yield session
