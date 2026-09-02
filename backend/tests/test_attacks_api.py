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
        email = f"atk-{uuid.uuid4().hex[:8]}@example.com"
        reg = await c.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "name": "AtkTester"},
        )
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        app.dependency_overrides[get_settings] = lambda: Settings(simulate_scan=True)
        try:
            yield c, headers
        finally:
            app.dependency_overrides.pop(get_settings, None)
            manager_module.engine_manager = None


async def _make_scan(c, headers, attacks):
    app_resp = await c.post(
        "/api/applications",
        json={
            "name": "Atk Target",
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-fake123456",
            "model_name": "gpt-4o-mini",
        },
        headers=headers,
    )
    app_id = app_resp.json()["id"]
    resp = await c.post(
        "/api/scans",
        json={
            "name": "attack-scan",
            "application_id": app_id,
            "datasets": [{"source": "builtin", "ref": "Content Safety"}],
            "concurrency": 4,
            "qpm": 600,
            "fail_threshold": 5.0,
            "attacks": attacks,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_attacks_endpoint_lists_builtin(sim_client) -> None:
    c, headers = sim_client
    resp = await c.get("/api/attacks", headers=headers)
    assert resp.status_code == 200
    keys = {a["key"] for a in resp.json()}
    assert {"default", "jailbreak", "injection", "many_shot"} <= keys


@pytest.mark.asyncio
async def test_scan_with_attacks_multiplies_cases(sim_client) -> None:
    c, headers = sim_client
    scan = await _make_scan(c, headers, ["jailbreak", "injection"])
    # 15 dataset prompts × 2 attacks = 30 cases
    assert scan["total_cases"] == 30
    assert scan["attacks"] == ["jailbreak", "injection"]

    for _ in range(100):
        prog = (await c.get(f"/api/scans/{scan['id']}/progress", headers=headers)).json()
        if prog["status"] == "completed":
            break
        await asyncio.sleep(0.05)
    assert prog["completed_cases"] == 30

    cases = (await c.get(f"/api/scans/{scan['id']}/cases?page_size=200", headers=headers)).json()
    assert cases["pagination"]["total_items"] == 30
    # every case carries its attack key
    assert {case["attack_key"] for case in cases["items"]} == {"jailbreak", "injection"}


@pytest.mark.asyncio
async def test_scan_baseline_without_attacks(sim_client) -> None:
    c, headers = sim_client
    scan = await _make_scan(c, headers, [])
    assert scan["total_cases"] == 15
    assert scan["attacks"] == []


@pytest.mark.asyncio
async def test_unknown_attack_rejected(sim_client) -> None:
    c, headers = sim_client
    app_resp = await c.post(
        "/api/applications",
        json={
            "name": "Atk Target 2",
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-fake123456",
            "model_name": "gpt-4o-mini",
        },
        headers=headers,
    )
    app_id = app_resp.json()["id"]
    resp = await c.post(
        "/api/scans",
        json={
            "name": "bad-attack",
            "application_id": app_id,
            "datasets": [{"source": "builtin", "ref": "Content Safety"}],
            "attacks": ["nope"],
        },
        headers=headers,
    )
    assert resp.status_code == 422
