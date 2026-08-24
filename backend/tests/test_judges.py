import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def auth_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        email = f"judge-{uuid.uuid4().hex[:8]}@example.com"
        reg = await client.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "name": "JudgeTester"},
        )
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        yield client, headers


JUDGE_PAYLOAD = {
    "name": "Local Qwen Judge",
    "description": "cheap local judge",
    "base_url": "http://localhost:11434/v1",
    "api_key": "ollama",
    "model_name": "qwen2.5:7b",
}


@pytest.mark.asyncio
async def test_judge_crud_roundtrip(auth_client) -> None:
    c, headers = auth_client

    created = await c.post("/api/judges", json=JUDGE_PAYLOAD, headers=headers)
    assert created.status_code == 201
    body = created.json()
    judge_id = body["id"]
    assert body["name"] == "Local Qwen Judge"
    assert body["api_key_masked"] == "oll****ama" or len(body["api_key_masked"]) > 0
    assert "api_key" not in body

    # duplicate name → 409
    assert (await c.post("/api/judges", json=JUDGE_PAYLOAD, headers=headers)).status_code == 409

    # list
    listed = (await c.get("/api/judges", headers=headers)).json()
    assert [j["id"] for j in listed] == [judge_id]

    # update (key omitted → untouched)
    updated = await c.patch(
        f"/api/judges/{judge_id}", json={"model_name": "qwen2.5:14b"}, headers=headers
    )
    assert updated.status_code == 200
    assert updated.json()["model_name"] == "qwen2.5:14b"

    # delete + 404
    assert (await c.delete(f"/api/judges/{judge_id}", headers=headers)).status_code == 204
    assert (await c.delete(f"/api/judges/{judge_id}", headers=headers)).status_code == 404


@pytest.mark.asyncio
async def test_scan_references_preset_judge(auth_client) -> None:
    c, headers = auth_client

    judge = (await c.post("/api/judges", json=JUDGE_PAYLOAD, headers=headers)).json()

    app_resp = await c.post(
        "/api/applications",
        json={
            "name": "Target",
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-fake123456",
            "model_name": "gpt-4o-mini",
        },
        headers=headers,
    )
    app_id = app_resp.json()["id"]

    # reference by judge_id — the scan snapshots the config
    scan_resp = await c.post(
        "/api/scans",
        json={
            "name": "preset-judge-scan",
            "application_id": app_id,
            "datasets": [{"source": "builtin", "ref": "Content Safety"}],
            "judge": {"judge_id": judge["id"]},
        },
        headers=headers,
    )
    assert scan_resp.status_code == 201
    scan = scan_resp.json()
    assert scan["judge_model"] == "qwen2.5:7b"
    assert scan["judge_base_url"] == "http://localhost:11434/v1"

    # inline overrides win over the preset
    override_resp = await c.post(
        "/api/scans",
        json={
            "name": "override-scan",
            "application_id": app_id,
            "datasets": [{"source": "builtin", "ref": "Content Safety"}],
            "judge": {"judge_id": judge["id"], "model": "qwen2.5:14b"},
        },
        headers=headers,
    )
    assert override_resp.status_code == 201
    assert override_resp.json()["judge_model"] == "qwen2.5:14b"

    # deleting the judge does not affect the snapshot
    await c.delete(f"/api/judges/{judge['id']}", headers=headers)
    detail = (await c.get(f"/api/scans/{scan['id']}", headers=headers)).json()
    assert detail["judge_model"] == "qwen2.5:7b"
    assert detail["judge_base_url"] == "http://localhost:11434/v1"

    # unknown judge_id → 404
    bad = await c.post(
        "/api/scans",
        json={
            "name": "bad-judge",
            "application_id": app_id,
            "datasets": [{"source": "builtin", "ref": "Content Safety"}],
            "judge": {"judge_id": 99999},
        },
        headers=headers,
    )
    assert bad.status_code == 404


@pytest.mark.asyncio
async def test_judge_options_snapshotted_into_scan(auth_client) -> None:
    """Provider options (e.g. enable_thinking: false) travel preset → snapshot
    → rerun, and stay on the snapshot after the preset is deleted."""
    c, headers = auth_client

    judge = (
        await c.post(
            "/api/judges",
            json={**JUDGE_PAYLOAD, "options": {"enable_thinking": False}},
            headers=headers,
        )
    ).json()
    assert judge["options"] == {"enable_thinking": False}

    app_resp = await c.post(
        "/api/applications",
        json={
            "name": "Target",
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-fake123456",
            "model_name": "gpt-4o-mini",
        },
        headers=headers,
    )
    app_id = app_resp.json()["id"]

    scan = (
        await c.post(
            "/api/scans",
            json={
                "name": "options-scan",
                "application_id": app_id,
                "datasets": [{"source": "builtin", "ref": "Content Safety"}],
                "judge": {"judge_id": judge["id"]},
            },
            headers=headers,
        )
    ).json()
    assert scan["judge_options"] == {"enable_thinking": False}

    rerun = (await c.post(f"/api/scans/{scan['id']}/rerun", headers=headers)).json()
    assert rerun["judge_options"] == {"enable_thinking": False}

    # snapshot survives preset deletion
    await c.delete(f"/api/judges/{judge['id']}", headers=headers)
    detail = (await c.get(f"/api/scans/{scan['id']}", headers=headers)).json()
    assert detail["judge_options"] == {"enable_thinking": False}


@pytest.mark.asyncio
async def test_judge_options_persisted_on_update(auth_client) -> None:
    """PATCH must persist options (regression: edit dialog checkbox state)."""
    c, headers = auth_client

    created = (await c.post("/api/judges", json=JUDGE_PAYLOAD, headers=headers)).json()
    assert created["options"] == {}

    updated = (
        await c.patch(
            f"/api/judges/{created['id']}",
            json={"options": {"enable_thinking": False}},
            headers=headers,
        )
    ).json()
    assert updated["options"] == {"enable_thinking": False}

    # survives re-fetch
    listed = (await c.get("/api/judges", headers=headers)).json()
    assert listed[0]["options"] == {"enable_thinking": False}

    # clearing works too
    cleared = (
        await c.patch(
            f"/api/judges/{created['id']}", json={"options": {}}, headers=headers
        )
    ).json()
    assert cleared["options"] == {}
