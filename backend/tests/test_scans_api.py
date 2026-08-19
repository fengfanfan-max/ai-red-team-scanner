"""Integration test: full scan lifecycle via the API with the simulated
engine (no network, no API keys — CI-safe)."""

import asyncio
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings, get_settings
from app.main import app


@pytest.fixture
async def sim_client():
    """Authenticated client with SIMULATE_SCAN enabled."""
    from app.engine import manager as manager_module

    # Fresh manager per test so engine choice follows the overridden settings.
    manager_module.engine_manager = None

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        email = f"scan-{uuid.uuid4().hex[:8]}@example.com"
        reg = await c.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "name": "ScanTester"},
        )
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

        app.dependency_overrides[get_settings] = lambda: Settings(simulate_scan=True)
        try:
            yield c, headers
        finally:
            app.dependency_overrides.pop(get_settings, None)
            manager_module.engine_manager = None


async def _create_application(c, headers) -> int:
    resp = await c.post(
        "/api/applications",
        json={
            "name": "Scan Target",
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-fake123456",
            "model_name": "gpt-4o-mini",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_scan(c, headers, app_id, name) -> dict:
    resp = await c.post(
        "/api/scans",
        json={
            "name": name,
            "application_id": app_id,
            "algorithm": "Default Tests",
            "datasets": [{"source": "builtin", "ref": "Content Safety"}],
            "concurrency": 4,
            "qpm": 600,
            "fail_threshold": 5.0,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_scan_full_lifecycle(sim_client) -> None:
    c, headers = sim_client
    app_id = await _create_application(c, headers)
    scan = await _create_scan(c, headers, app_id, "lifecycle-scan")

    assert scan["total_cases"] == 15  # Content Safety: 3 subcategories × 5 prompts
    assert scan["status"] in ("pending", "running")
    assert scan["progress_pct"] == 0

    # poll until completed
    for _ in range(100):
        prog = (await c.get(f"/api/scans/{scan['id']}/progress", headers=headers)).json()
        if prog["status"] == "completed":
            break
        await asyncio.sleep(0.05)
    assert prog["status"] == "completed"
    assert prog["completed_cases"] == 15
    assert prog["progress_pct"] == 100.0
    assert prog["passed_cases"] + prog["failed_cases"] + prog["error_cases"] == 15

    results = (await c.get(f"/api/scans/{scan['id']}/results", headers=headers)).json()
    assert results["safety_score"] is not None
    assert 0 <= results["safety_score"] <= 100
    assert len(results["by_category"]) == 1
    assert results["by_category"][0]["total"] == 15
    assert results["by_category"][0]["passed"] + results["by_category"][0]["failed"] == 15

    # detail endpoint agrees
    detail = (await c.get(f"/api/scans/{scan['id']}", headers=headers)).json()
    assert detail["status"] == "completed"
    assert detail["safety_score"] == results["safety_score"]


@pytest.mark.asyncio
async def test_scan_with_custom_dataset(sim_client) -> None:
    """Custom datasets participate in scans (regression: subcategory key)."""
    c, headers = sim_client
    created = await c.post(
        "/api/datasets/custom",
        json={
            "name": "Scan Custom",
            "subcategories": [
                {"name": "Sub A", "prompts": ["p1", "p2", "p3"]},
                {"name": "Sub B", "prompts": ["p4"]},
            ],
        },
        headers=headers,
    )
    assert created.status_code == 201
    custom_id = created.json()["id"]

    app_id = await _create_application(c, headers)
    scan = await _create_scan(
        c,
        headers,
        app_id,
        "custom-scan",
    )
    # rebuild with the custom dataset ref
    resp = await c.post(
        "/api/scans",
        json={
            "name": "custom-scan",
            "application_id": app_id,
            "datasets": [{"source": "custom", "ref": str(custom_id)}],
            "concurrency": 4,
            "qpm": 600,
            "fail_threshold": 5.0,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    scan = resp.json()
    assert scan["total_cases"] == 4

    for _ in range(100):
        prog = (await c.get(f"/api/scans/{scan['id']}/progress", headers=headers)).json()
        if prog["status"] == "completed":
            break
        await asyncio.sleep(0.05)
    assert prog["status"] == "completed"
    assert prog["completed_cases"] == 4

    results = (await c.get(f"/api/scans/{scan['id']}/results", headers=headers)).json()
    assert len(results["by_category"]) == 1
    assert results["by_category"][0]["dataset_name"] == "Scan Custom"
    assert results["by_category"][0]["total"] == 4


@pytest.mark.asyncio
async def test_scan_list_pagination_and_filter(sim_client) -> None:
    c, headers = sim_client
    app_id = await _create_application(c, headers)
    for i in range(3):
        await _create_scan(c, headers, app_id, f"scan-{i}")

    page1 = (await c.get("/api/scans?page=1&page_size=2", headers=headers)).json()
    assert len(page1["items"]) == 2
    assert page1["pagination"]["total_items"] >= 3
    assert page1["pagination"]["next_page"] == 2

    page2 = (await c.get("/api/scans?page=2&page_size=2", headers=headers)).json()
    assert len(page2["items"]) == 2
    assert page2["pagination"]["prev_page"] == 1

    filtered = (await c.get("/api/scans?status=pending", headers=headers)).json()
    assert all(item["status"] == "pending" for item in filtered["items"])


@pytest.mark.asyncio
async def test_scan_validation_errors(sim_client) -> None:
    c, headers = sim_client
    app_id = await _create_application(c, headers)

    # unknown application
    bad_app = {
        "name": "x",
        "application_id": 99999,
        "datasets": [{"source": "builtin", "ref": "Content Safety"}],
    }
    resp = await c.post("/api/scans", json=bad_app, headers=headers)
    assert resp.status_code == 404

    # unknown dataset
    bad_ds = {
        "name": "x",
        "application_id": app_id,
        "datasets": [{"source": "builtin", "ref": "Nope"}],
    }
    resp = await c.post("/api/scans", json=bad_ds, headers=headers)
    assert resp.status_code == 422

    # missing scan → 404
    assert (await c.get("/api/scans/99999", headers=headers)).status_code == 404
    assert (await c.get("/api/scans/99999/progress", headers=headers)).status_code == 404
