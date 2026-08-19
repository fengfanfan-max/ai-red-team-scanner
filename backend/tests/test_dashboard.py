import asyncio
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings, get_settings
from app.main import app


@pytest.fixture
async def sim_client():
    from app.engine import manager as manager_module

    manager_module.engine_manager = None
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        email = f"dash-{uuid.uuid4().hex[:8]}@example.com"
        reg = await c.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "name": "DashTester"},
        )
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        app.dependency_overrides[get_settings] = lambda: Settings(simulate_scan=True)
        try:
            yield c, headers
        finally:
            app.dependency_overrides.pop(get_settings, None)
            manager_module.engine_manager = None


async def _run_one_scan(c, headers) -> int:
    reg = await c.post(
        "/api/auth/register",
        json={
            "email": f"dash-{uuid.uuid4().hex[:8]}@example.com",
            "password": "password123",
            "name": "U",
        },
    )
    h = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    app_resp = await c.post(
        "/api/applications",
        json={
            "name": "Dash Target",
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-fake123456",
            "model_name": "gpt-4o-mini",
        },
        headers=h,
    )
    app_id = app_resp.json()["id"]
    scan_resp = await c.post(
        "/api/scans",
        json={
            "name": "dash-scan",
            "application_id": app_id,
            "datasets": [{"source": "builtin", "ref": "Content Safety"}],
            "concurrency": 4,
            "qpm": 600,
            "fail_threshold": 5.0,
        },
        headers=h,
    )
    scan_id = scan_resp.json()["id"]
    for _ in range(100):
        prog = (await c.get(f"/api/scans/{scan_id}/progress", headers=h)).json()
        if prog["status"] == "completed":
            return scan_id
        await asyncio.sleep(0.05)
    raise AssertionError("scan did not complete")


@pytest.mark.asyncio
async def test_dashboard_empty_state(sim_client) -> None:
    c, headers = sim_client
    resp = await c.get("/api/dashboard", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["stats"]["total_scans"] == 0
    assert body["stats"]["avg_safety_score"] is None
    assert body["recent_scans"] == []
    assert body["risk_by_category"] == []


@pytest.mark.asyncio
async def test_dashboard_after_completed_scan(sim_client) -> None:
    c, headers = sim_client
    await _run_one_scan(c, headers)

    resp = await c.get("/api/dashboard", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    stats = body["stats"]
    assert stats["total_scans"] >= 1
    assert stats["completed_scans"] >= 1
    assert stats["avg_safety_score"] is not None
    assert 0 <= stats["avg_safety_score"] <= 100
    assert len(body["recent_scans"]) >= 1
    assert body["recent_scans"][0]["status"] == "completed"

    cats = body["risk_by_category"]
    assert any(c["dataset_name"] == "Content Safety" for c in cats)
    content = next(c for c in cats if c["dataset_name"] == "Content Safety")
    assert content["total"] == 15
    assert content["failed"] + content["total"] - content["failed"] == content["total"]
