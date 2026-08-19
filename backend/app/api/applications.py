from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbDep, SettingsDep
from app.core.crypto import decrypt_api_key, encrypt_api_key, mask_api_key
from app.models import AIApplication
from app.schemas import (
    ApplicationCreate,
    ApplicationOut,
    ApplicationUpdate,
    TestChatRequest,
    TestChatResponse,
)
from app.services.llm import LLMError, chat_completion

router = APIRouter(prefix="/api/applications", tags=["applications"])


def _to_out(app: AIApplication, settings: SettingsDep) -> ApplicationOut:
    # Mask derived from the DECRYPTED key so users recognize their own key
    # shape (sk-****abcd); the plaintext itself never leaves the server.
    plain = decrypt_api_key(app.api_key_cipher, settings) if app.api_key_cipher else ""
    return ApplicationOut(
        id=app.id,
        name=app.name,
        base_url=app.base_url,
        api_key_masked=mask_api_key(plain) if plain else "",
        model_name=app.model_name,
        input_modalities=app.input_modalities,
        output_modalities=app.output_modalities,
        created_at=app.created_at,
        updated_at=app.updated_at,
    )


@router.get("", response_model=list[ApplicationOut])
async def list_applications(db: DbDep, settings: SettingsDep) -> list[ApplicationOut]:
    rows = (await db.scalars(select(AIApplication).order_by(AIApplication.created_at.desc()))).all()
    return [_to_out(app, settings) for app in rows]


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
async def create_application(
    payload: ApplicationCreate, db: DbDep, settings: SettingsDep, user: CurrentUser
) -> ApplicationOut:
    app = AIApplication(
        name=payload.name,
        base_url=payload.base_url,
        api_key_cipher=encrypt_api_key(payload.api_key, settings) if payload.api_key else "",
        model_name=payload.model_name,
        input_modalities=payload.input_modalities,
        output_modalities=payload.output_modalities,
        created_by=user.id if user else None,
    )
    db.add(app)
    await db.commit()
    await db.refresh(app)
    return _to_out(app, settings)


@router.get("/{app_id}", response_model=ApplicationOut)
async def get_application(app_id: int, db: DbDep, settings: SettingsDep) -> ApplicationOut:
    app = await db.get(AIApplication, app_id)
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    return _to_out(app, settings)


@router.patch("/{app_id}", response_model=ApplicationOut)
async def update_application(
    app_id: int, payload: ApplicationUpdate, db: DbDep, settings: SettingsDep
) -> ApplicationOut:
    app = await db.get(AIApplication, app_id)
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    updates = payload.model_dump(exclude_unset=True)
    if "api_key" in updates:
        # None = keep existing; "" = clear; otherwise re-encrypt.
        if updates["api_key"] is None:
            del updates["api_key"]
        else:
            updates["api_key_cipher"] = (
                encrypt_api_key(updates.pop("api_key"), settings) if updates["api_key"] else ""
            )

    for field, value in updates.items():
        setattr(app, field, value)
    await db.commit()
    await db.refresh(app)
    return _to_out(app, settings)


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(app_id: int, db: DbDep) -> None:
    app = await db.get(AIApplication, app_id)
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    await db.delete(app)
    await db.commit()


@router.post("/{app_id}/test-chat", response_model=TestChatResponse)
async def test_chat(
    app_id: int, payload: TestChatRequest, db: DbDep, settings: SettingsDep
) -> TestChatResponse:
    """One-shot chat with the target model to validate connectivity/config."""
    app = await db.get(AIApplication, app_id)
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    if settings.simulate_scan:
        return TestChatResponse(
            reply=f"[simulated] Reply to: {payload.message[:120]}",
            simulated=True,
        )

    api_key = decrypt_api_key(app.api_key_cipher, settings) if app.api_key_cipher else ""
    # Key is optional: local endpoints (Ollama/vLLM) don't require one; cloud
    # providers will 401 and surface as a clear 502 error below.

    try:
        reply = await chat_completion(
            base_url=app.base_url,
            api_key=api_key,
            model=app.model_name,
            messages=[{"role": "user", "content": payload.message}],
        )
    except LLMError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return TestChatResponse(reply=reply)
