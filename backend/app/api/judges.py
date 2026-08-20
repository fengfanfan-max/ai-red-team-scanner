from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbDep, SettingsDep
from app.core.crypto import decrypt_api_key, encrypt_api_key, mask_api_key
from app.models import JudgeModel
from app.schemas import JudgeModelCreate, JudgeModelOut, JudgeModelUpdate

router = APIRouter(prefix="/api/judges", tags=["judges"])


def _to_out(judge: JudgeModel, settings: SettingsDep) -> JudgeModelOut:
    plain = decrypt_api_key(judge.api_key_cipher, settings) if judge.api_key_cipher else ""
    return JudgeModelOut(
        id=judge.id,
        name=judge.name,
        description=judge.description,
        base_url=judge.base_url,
        api_key_masked=mask_api_key(plain) if plain else "",
        model_name=judge.model_name,
        created_at=judge.created_at,
        updated_at=judge.updated_at,
    )


@router.get("", response_model=list[JudgeModelOut])
async def list_judges(db: DbDep, settings: SettingsDep) -> list[JudgeModelOut]:
    rows = (await db.scalars(select(JudgeModel).order_by(JudgeModel.created_at.desc()))).all()
    return [_to_out(j, settings) for j in rows]


@router.post("", response_model=JudgeModelOut, status_code=status.HTTP_201_CREATED)
async def create_judge(
    payload: JudgeModelCreate, db: DbDep, settings: SettingsDep, user: CurrentUser
) -> JudgeModelOut:
    existing = await db.scalar(select(JudgeModel).where(JudgeModel.name == payload.name))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="A judge with this name already exists"
        )
    judge = JudgeModel(
        name=payload.name,
        description=payload.description,
        base_url=payload.base_url,
        api_key_cipher=encrypt_api_key(payload.api_key, settings) if payload.api_key else "",
        model_name=payload.model_name,
        created_by=user.id if user else None,
    )
    db.add(judge)
    await db.commit()
    await db.refresh(judge)
    return _to_out(judge, settings)


@router.patch("/{judge_id}", response_model=JudgeModelOut)
async def update_judge(
    judge_id: int, payload: JudgeModelUpdate, db: DbDep, settings: SettingsDep
) -> JudgeModelOut:
    judge = await db.get(JudgeModel, judge_id)
    if judge is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Judge not found")

    updates = payload.model_dump(exclude_unset=True)
    if "api_key" in updates:
        if updates["api_key"] is None:
            del updates["api_key"]
        else:
            updates["api_key_cipher"] = (
                encrypt_api_key(updates.pop("api_key"), settings) if updates["api_key"] else ""
            )
    for field, value in updates.items():
        setattr(judge, field, value)
    await db.commit()
    await db.refresh(judge)
    return _to_out(judge, settings)


@router.delete("/{judge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_judge(judge_id: int, db: DbDep) -> None:
    judge = await db.get(JudgeModel, judge_id)
    if judge is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Judge not found")
    await db.delete(judge)
    await db.commit()
