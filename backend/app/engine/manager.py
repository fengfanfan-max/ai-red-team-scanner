"""Engine task manager: per-scan asyncio tasks + startup recovery."""

import asyncio
import logging

from sqlalchemy import select

from app.core.config import Settings
from app.core.db import SessionLocal
from app.engine.base import STATUS_PENDING, STATUS_RUNNING, ScanEngine
from app.engine.openai_engine import OpenAIChatEngine
from app.engine.simulated_engine import SimulatedEngine
from app.models import Scan

logger = logging.getLogger(__name__)


class EngineManager:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._tasks: dict[int, asyncio.Task] = {}

    def _new_engine(self) -> ScanEngine:
        if self.settings.simulate_scan:
            return SimulatedEngine()
        return OpenAIChatEngine(self.settings)

    def start(self, scan_id: int) -> None:
        """Kick off (or re-attach to) a scan task. Idempotent per scan_id."""
        existing = self._tasks.get(scan_id)
        if existing is not None and not existing.done():
            return
        engine = self._new_engine()

        async def _guard() -> None:
            try:
                await engine.run(scan_id)
            except Exception:  # noqa: BLE001 - engine.run already guards, belt & suspenders
                logger.exception("Unhandled engine error for scan %s", scan_id)
            finally:
                self._tasks.pop(scan_id, None)

        self._tasks[scan_id] = asyncio.create_task(_guard())

    async def recover(self) -> None:
        """On startup: resume scans that were pending/running (ADR-0003:
        DB checkpoint rows let us continue where we left off)."""
        try:
            async with SessionLocal() as db:
                rows = (
                    await db.scalars(
                        select(Scan).where(Scan.status.in_([STATUS_PENDING, STATUS_RUNNING]))
                    )
                ).all()
        except Exception:  # noqa: BLE001 - migrations may not have run yet
            logger.warning("Scan recovery skipped (database not ready?)")
            return
        for scan in rows:
            logger.info("Recovering scan %s (%s)", scan.id, scan.status)
            self.start(scan.id)


engine_manager: EngineManager | None = None


def get_engine_manager(settings: Settings) -> EngineManager:
    global engine_manager
    if engine_manager is None:
        engine_manager = EngineManager(settings)
    return engine_manager
