import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["app"] == "ai-red-team-scanner"


@pytest.mark.asyncio
async def test_meta_reports_runtime_mode() -> None:
    """The UI reads /api/meta to show whether this is a demo (simulated) instance."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/meta")

    assert resp.status_code == 200
    body = resp.json()
    assert body["app"] == "ai-red-team-scanner"
    assert "version" in body
    assert isinstance(body["simulate_scan"], bool)
    assert body["auth_mode"] in ("enabled", "disabled")
