import logging
import os

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_request_log_line(caplog) -> None:
    """Every non-health request logs method/path/status/duration."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with caplog.at_level(logging.INFO, logger="app.request"):
            resp = await client.get("/api/scans/99999")
            assert resp.status_code == 404

    lines = [r for r in caplog.records if r.name == "app.request"]
    assert len(lines) == 1
    assert lines[0].getMessage().startswith("GET /api/scans/99999 404 (")
    assert "404" in lines[0].getMessage()


@pytest.mark.asyncio
async def test_health_is_not_logged(caplog) -> None:
    """Health checks are excluded so they don't spam the log."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with caplog.at_level(logging.INFO, logger="app.request"):
            resp = await client.get("/api/health")
            assert resp.status_code == 200

    lines = [r for r in caplog.records if r.name == "app.request"]
    assert lines == []


def test_logging_setup_levels_and_file(monkeypatch, tmp_path) -> None:
    """LOG_LEVEL controls verbosity; LOG_FILE adds a rotating file handler."""
    from app.core.logging import setup_logging

    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    monkeypatch.setenv("LOG_FILE", str(tmp_path / "app.log"))
    setup_logging()

    root = logging.getLogger()
    assert root.level == logging.DEBUG
    handler_types = {type(h).__name__ for h in root.handlers}
    assert "RotatingFileHandler" in handler_types
    assert "StreamHandler" in handler_types

    # uvicorn access logs stay quiet unless explicitly debugging the server
    assert logging.getLogger("uvicorn.access").level >= logging.WARNING

    os.environ.pop("LOG_FILE", None)
    os.environ.pop("LOG_LEVEL", None)
