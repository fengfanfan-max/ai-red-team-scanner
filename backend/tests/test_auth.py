import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _register(
    client: AsyncClient, email="user@example.com", password="password123", name="Tester"
):
    return await client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "name": name},
    )


@pytest.mark.asyncio
async def test_register_and_me_roundtrip(client: AsyncClient) -> None:
    resp = await _register(client)
    assert resp.status_code == 201
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "user@example.com"
    assert "access_token" in body

    me = await client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == "user@example.com"
    assert me.json()["guest"] is False


@pytest.mark.asyncio
async def test_register_duplicate_email_conflicts(client: AsyncClient) -> None:
    assert (await _register(client, email="dup@example.com")).status_code == 201
    resp = await _register(client, email="dup@example.com")
    assert resp.status_code == 409
    assert "already registered" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_login_wrong_password_rejected(client: AsyncClient) -> None:
    await _register(client, email="login@example.com")
    resp = await client.post(
        "/api/auth/login", json={"email": "login@example.com", "password": "wrong-password"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_email_rejected(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "whatever123"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_without_token_rejected(client: AsyncClient) -> None:
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401
    assert resp.headers.get("www-authenticate") == "Bearer"


@pytest.mark.asyncio
async def test_me_with_garbage_token_rejected(client: AsyncClient) -> None:
    resp = await client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_change_password_flow(client: AsyncClient) -> None:
    reg = await _register(client, email="cp@example.com")
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # wrong old password
    bad = await client.post(
        "/api/auth/change-password",
        json={"old_password": "nope", "new_password": "new-password456"},
        headers=headers,
    )
    assert bad.status_code == 400

    ok = await client.post(
        "/api/auth/change-password",
        json={"old_password": "password123", "new_password": "new-password456"},
        headers=headers,
    )
    assert ok.status_code == 204

    # old password no longer works, new one does
    old = await client.post(
        "/api/auth/login", json={"email": "cp@example.com", "password": "password123"}
    )
    assert old.status_code == 401
    new = await client.post(
        "/api/auth/login", json={"email": "cp@example.com", "password": "new-password456"}
    )
    assert new.status_code == 200


@pytest.mark.asyncio
async def test_weak_password_rejected(client: AsyncClient) -> None:
    resp = await _register(client, password="short")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_auth_disabled_mode_returns_guest(monkeypatch) -> None:
    from app.core.config import Settings, get_settings

    # Canonical FastAPI test pattern: override the dependency at app level.
    monkeypatch.setitem(
        app.dependency_overrides, get_settings, lambda: Settings(auth_mode="disabled")
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        me = await client.get("/api/auth/me")
        assert me.status_code == 200
        body = me.json()
        assert body["guest"] is True
        assert body["id"] is None
