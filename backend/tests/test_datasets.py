import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        email = f"ds-{uuid.uuid4().hex[:8]}@example.com"
        reg = await c.post(
            "/api/auth/register",
            json={"email": email, "password": "password123", "name": "DsTester"},
        )
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        yield c, headers


@pytest.mark.asyncio
async def test_list_datasets_contains_builtin(client) -> None:
    c, headers = client
    resp = await c.get("/api/datasets", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["builtin"]) >= 4
    names = {d["name"] for d in body["builtin"]}
    assert "Content Safety" in names
    for d in body["builtin"]:
        assert d["subcategories"]
        for sub in d["subcategories"]:
            assert sub["prompts"]


@pytest.mark.asyncio
async def test_custom_dataset_crud(client) -> None:
    c, headers = client
    payload = {
        "name": "My Custom Set",
        "description": "mine",
        "subcategories": [
            {"name": "Sub A", "prompts": ["p1", "p2"]},
            {"name": "Sub B", "prompts": ["p3"]},
        ],
    }
    created = await c.post("/api/datasets/custom", json=payload, headers=headers)
    assert created.status_code == 201
    body = created.json()
    assert body["subcategory_count"] == 2
    assert body["prompt_count"] == 3

    # duplicate name → 409
    dup = await c.post("/api/datasets/custom", json=payload, headers=headers)
    assert dup.status_code == 409

    # visible in merged list
    listed = await c.get("/api/datasets", headers=headers)
    custom_names = [d["name"] for d in listed.json()["custom"]]
    assert "My Custom Set" in custom_names

    # delete
    deleted = await c.delete(f"/api/datasets/custom/{body['id']}", headers=headers)
    assert deleted.status_code == 204
    assert (
        await c.delete(f"/api/datasets/custom/{body['id']}", headers=headers)
    ).status_code == 404


@pytest.mark.asyncio
async def test_custom_dataset_validation(client) -> None:
    c, headers = client
    # too many subcategories
    too_many = {
        "name": "Too Many",
        "subcategories": [{"name": f"s{i}", "prompts": ["p"]} for i in range(21)],
    }
    resp = await c.post("/api/datasets/custom", json=too_many, headers=headers)
    assert resp.status_code == 422

    # empty subcategory prompts
    empty = {"name": "Empty", "subcategories": [{"name": "s", "prompts": []}]}
    resp = await c.post("/api/datasets/custom", json=empty, headers=headers)
    assert resp.status_code == 422
