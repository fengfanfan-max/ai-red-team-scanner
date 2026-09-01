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
        email = f"cases-{uuid.uuid4().hex[:8]}@example.com"
        reg = await c.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "name": "CasesTester"},
        )
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        app.dependency_overrides[get_settings] = lambda: Settings(simulate_scan=True)
        try:
            yield c, headers
        finally:
            app.dependency_overrides.pop(get_settings, None)
            manager_module.engine_manager = None


async def _completed_scan(c, headers) -> dict:
    app_resp = await c.post(
        "/api/applications",
        json={
            "name": "Cases Target",
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-fake123456",
            "model_name": "gpt-4o-mini",
        },
        headers=headers,
    )
    app_id = app_resp.json()["id"]
    scan_resp = await c.post(
        "/api/scans",
        json={
            "name": "cases-scan",
            "application_id": app_id,
            "datasets": [{"source": "builtin", "ref": "Content Safety"}],
            "concurrency": 4,
            "qpm": 600,
            "fail_threshold": 5.0,
        },
        headers=headers,
    )
    scan_id = scan_resp.json()["id"]
    for _ in range(100):
        prog = (await c.get(f"/api/scans/{scan_id}/progress", headers=headers)).json()
        if prog["status"] == "completed":
            return {"id": scan_id, "app_id": app_id}
        await asyncio.sleep(0.05)
    raise AssertionError("scan did not complete")


@pytest.mark.asyncio
async def test_cases_pagination_and_filter(sim_client) -> None:
    c, headers = sim_client
    scan = await _completed_scan(c, headers)

    page1 = (
        await c.get(f"/api/scans/{scan['id']}/cases?page=1&page_size=10", headers=headers)
    ).json()
    assert len(page1["items"]) == 10
    assert page1["pagination"]["total_items"] == 15
    assert page1["pagination"]["next_page"] == 2
    assert page1["pagination"]["total_pages"] == 2

    page2 = (
        await c.get(f"/api/scans/{scan['id']}/cases?page=2&page_size=10", headers=headers)
    ).json()
    assert len(page2["items"]) == 5

    # every row exposes the full detail (incl. latency)
    row = page1["items"][0]
    assert row["dataset_name"] == "Content Safety"
    assert row["prompt"]
    assert row["judge_status"] in ("passed", "failed", "judge_error", "target_error")
    assert "latency_ms" in row
    assert "answer" in row

    # status filters are disjoint and exhaustive
    passed = (
        await c.get(
            f"/api/scans/{scan['id']}/cases?status=passed&page_size=200", headers=headers
        )
    ).json()
    failed = (
        await c.get(
            f"/api/scans/{scan['id']}/cases?status=failed&page_size=200", headers=headers
        )
    ).json()
    errors = (
        await c.get(
            f"/api/scans/{scan['id']}/cases?status=errors&page_size=200", headers=headers
        )
    ).json()
    total_filtered = (
        passed["pagination"]["total_items"]
        + failed["pagination"]["total_items"]
        + errors["pagination"]["total_items"]
    )
    assert total_filtered == 15
    assert all(item["judge_status"] == "passed" for item in passed["items"])

    # unknown filter → 422
    bad = await c.get(f"/api/scans/{scan['id']}/cases?status=nope", headers=headers)
    assert bad.status_code == 422

    # missing scan → 404
    assert (await c.get("/api/scans/99999/cases", headers=headers)).status_code == 404


@pytest.mark.asyncio
async def test_rerun_creates_independent_copy(sim_client) -> None:
    c, headers = sim_client
    completed = await _completed_scan(c, headers)  # 15/15 finished

    rerun = await c.post(f"/api/scans/{completed['id']}/rerun", headers=headers)
    assert rerun.status_code == 201
    body = rerun.json()

    # new, independent scan with copied configuration
    orig = (await c.get(f"/api/scans/{completed['id']}", headers=headers)).json()
    assert body["id"] != orig["id"]
    assert body["name"] == f"{orig['name']} (rerun)"
    assert body["application_id"] == orig["application_id"]
    assert body["datasets"] == orig["datasets"]
    assert body["concurrency"] == orig["concurrency"]
    assert body["qpm"] == orig["qpm"]
    assert body["fail_threshold"] == orig["fail_threshold"]
    assert body["total_cases"] == 15
    assert body["status"] in ("pending", "running")
    # fresh counters, original untouched
    assert body["completed_cases"] == 0
    assert orig["completed_cases"] == 15

    # rerun completes on its own
    for _ in range(100):
        prog = (await c.get(f"/api/scans/{body['id']}/progress", headers=headers)).json()
        if prog["status"] == "completed":
            break
        await asyncio.sleep(0.05)
    assert prog["completed_cases"] == 15

    # judge config is copied as well (ciphertext, never decrypted)
    judge_scan = await c.post(
        "/api/scans",
        json={
            "name": "judge-copy",
            "application_id": completed["app_id"],
            "datasets": [{"source": "builtin", "ref": "Content Safety"}],
            "judge": {"base_url": "http://localhost:11434/v1", "model": "qwen2.5:3b"},
        },
        headers=headers,
    )
    judge_original = judge_scan.json()
    judge_rerun = (
        await c.post(f"/api/scans/{judge_original['id']}/rerun", headers=headers)
    ).json()
    assert judge_rerun["judge_model"] == "qwen2.5:3b"
    assert judge_rerun["judge_base_url"] == "http://localhost:11434/v1"

    # missing scan → 404
    assert (await c.post("/api/scans/99999/rerun", headers=headers)).status_code == 404


@pytest.mark.asyncio
async def test_rerun_groups_into_scan_family(sim_client) -> None:
    """A scan and its reruns share a family_id; /runs lists the whole history."""
    c, headers = sim_client
    completed = await _completed_scan(c, headers)

    root = (await c.get(f"/api/scans/{completed['id']}", headers=headers)).json()
    assert root["family_id"] is None  # root of its own family

    rerun1 = (await c.post(f"/api/scans/{completed['id']}/rerun", headers=headers)).json()
    rerun2 = (await c.post(f"/api/scans/{rerun1['id']}/rerun", headers=headers)).json()

    # reruns inherit the family root id
    family = root["id"]
    assert rerun1["family_id"] == family
    assert rerun2["family_id"] == family

    # /runs returns the whole chain, oldest first
    runs = (await c.get(f"/api/scans/{rerun2['id']}/runs", headers=headers)).json()
    assert [r["id"] for r in runs] == [root["id"], rerun1["id"], rerun2["id"]]
    assert all(r["family_id"] == family for r in runs[1:])

    # a separate fresh scan is its own family (not grouped with this one)
    fresh = await _completed_scan(c, headers)
    fresh_detail = (await c.get(f"/api/scans/{fresh['id']}", headers=headers)).json()
    fresh_runs = (await c.get(f"/api/scans/{fresh['id']}/runs", headers=headers)).json()
    assert fresh_detail["family_id"] is None
    assert len(fresh_runs) == 1

    assert (await c.get("/api/scans/99999/runs", headers=headers)).status_code == 404


@pytest.mark.asyncio
async def test_scan_detail_exposes_judge_config(sim_client) -> None:
    c, headers = sim_client
    scan = await _completed_scan(c, headers)

    detail = (await c.get(f"/api/scans/{scan['id']}", headers=headers)).json()
    # judge follows target → fields are null but present
    assert "judge_model" in detail
    assert "judge_base_url" in detail
    assert detail["judge_model"] is None

    # with an explicit judge config, it shows up
    resp = await c.post(
        "/api/scans",
        json={
            "name": "judge-config-scan",
            "application_id": scan["app_id"],
            "datasets": [{"source": "builtin", "ref": "Content Safety"}],
            "judge": {"base_url": "http://localhost:11434/v1", "model": "qwen2.5:3b"},
        },
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["judge_model"] == "qwen2.5:3b"
    assert body["judge_base_url"] == "http://localhost:11434/v1"
