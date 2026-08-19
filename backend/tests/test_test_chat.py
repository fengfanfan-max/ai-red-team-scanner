import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings, get_settings
from app.main import app
from app.services import llm


@pytest.fixture
async def auth_client():
    """Client pre-authenticated with a fresh user (unique email per test)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        email = f"chat-{uuid.uuid4().hex[:8]}@example.com"
        reg = await client.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "name": "ChatTester"},
        )
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        yield client, headers


async def _create_app(client, headers, **overrides):
    payload = {
        "name": "Chat App",
        "base_url": "https://api.openai.com/v1",
        "api_key": "sk-chatkey123456",
        "model_name": "gpt-4o-mini",
        **overrides,
    }
    resp = await client.post("/api/applications", json=payload, headers=headers)
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_test_chat_without_key_calls_with_empty_key(auth_client, monkeypatch) -> None:
    """Local endpoints (Ollama) need no key: the request must still be sent,
    just without an Authorization header."""
    monkeypatch.setitem(
        app.dependency_overrides, get_settings, lambda: Settings(simulate_scan=False)
    )
    captured: dict = {}

    async def _fake_chat(base_url, api_key, model, messages, **kwargs):
        captured["base_url"] = base_url
        captured["api_key"] = api_key
        return "hello from the model"

    monkeypatch.setattr("app.api.applications.chat_completion", _fake_chat)

    client, headers = auth_client
    app_id = await _create_app(client, headers, api_key="")

    resp = await client.post(
        f"/api/applications/{app_id}/test-chat", json={"message": "hi"}, headers=headers
    )
    assert resp.status_code == 200
    assert resp.json()["reply"] == "hello from the model"
    assert captured["api_key"] == ""
    assert captured["base_url"] == "https://api.openai.com/v1"


@pytest.mark.asyncio
async def test_test_chat_simulated_mode(auth_client, monkeypatch) -> None:
    """SIMULATE mode returns a canned reply without any network call."""
    monkeypatch.setitem(
        app.dependency_overrides, get_settings, lambda: Settings(simulate_scan=True)
    )
    client, headers = auth_client
    app_id = await _create_app(client, headers)

    resp = await client.post(
        f"/api/applications/{app_id}/test-chat", json={"message": "hello there"}, headers=headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["simulated"] is True
    assert "hello there" in body["reply"]


@pytest.mark.asyncio
async def test_test_chat_forwards_llm_error(auth_client, monkeypatch) -> None:
    """A failing upstream model surfaces as 502 with a useful message."""
    monkeypatch.setitem(
        app.dependency_overrides, get_settings, lambda: Settings(simulate_scan=False)
    )

    async def _boom(*args, **kwargs):
        raise llm.LLMError(
            "Request to https://api.openai.com/v1/chat/completions failed: boom"
        )

    monkeypatch.setattr("app.api.applications.chat_completion", _boom)

    client, headers = auth_client
    app_id = await _create_app(client, headers)

    resp = await client.post(
        f"/api/applications/{app_id}/test-chat", json={"message": "hi"}, headers=headers
    )
    assert resp.status_code == 502
    assert "boom" in resp.json()["detail"]
