import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def auth_client():
    """Client pre-authenticated with a fresh user (unique email per test)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        email = f"app-{uuid.uuid4().hex[:8]}@example.com"
        reg = await client.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "name": "AppTester"},
        )
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        yield client, headers


APP_PAYLOAD = {
    "name": "My GPT",
    "base_url": "https://api.openai.com/v1",
    "api_key": "sk-abcdefghijklmnop",
    "model_name": "gpt-4o-mini",
}


@pytest.mark.asyncio
async def test_application_crud_roundtrip(auth_client) -> None:
    client, headers = auth_client

    # create
    created = await client.post("/api/applications", json=APP_PAYLOAD, headers=headers)
    assert created.status_code == 201
    body = created.json()
    app_id = body["id"]
    assert body["name"] == "My GPT"
    # api key never leaves the server unmasked
    assert body["api_key_masked"] == "sk-****mnop"
    assert "api_key" not in body

    # list
    listed = await client.get("/api/applications", headers=headers)
    assert listed.status_code == 200
    assert [a["id"] for a in listed.json()] == [app_id]

    # get
    got = await client.get(f"/api/applications/{app_id}", headers=headers)
    assert got.status_code == 200
    assert got.json()["base_url"] == "https://api.openai.com/v1"

    # update (keep key untouched when api_key omitted)
    updated = await client.patch(
        f"/api/applications/{app_id}", json={"name": "My GPT v2"}, headers=headers
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "My GPT v2"
    assert updated.json()["api_key_masked"] == "sk-****mnop"

    # update with new key re-encrypts
    rekeyed = await client.patch(
        f"/api/applications/{app_id}", json={"api_key": "sk-newkey123456"}, headers=headers
    )
    assert rekeyed.status_code == 200
    assert rekeyed.json()["api_key_masked"] == "sk-****3456"

    # delete
    deleted = await client.delete(f"/api/applications/{app_id}", headers=headers)
    assert deleted.status_code == 204

    # gone
    gone = await client.get(f"/api/applications/{app_id}", headers=headers)
    assert gone.status_code == 404


@pytest.mark.asyncio
async def test_application_requires_auth(auth_client) -> None:
    client, _ = auth_client
    resp = await client.post("/api/applications", json=APP_PAYLOAD)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_missing_application_404(auth_client) -> None:
    client, headers = auth_client
    assert (await client.get("/api/applications/99999", headers=headers)).status_code == 404
    assert (await client.delete("/api/applications/99999", headers=headers)).status_code == 404
    assert (
        await client.patch("/api/applications/99999", json={"name": "x"}, headers=headers)
    ).status_code == 404


@pytest.mark.asyncio
async def test_validation_rejects_bad_payload(auth_client) -> None:
    client, headers = auth_client
    resp = await client.post(
        "/api/applications",
        json={"name": "", "base_url": "x", "model_name": ""},
        headers=headers,
    )
    assert resp.status_code == 422
