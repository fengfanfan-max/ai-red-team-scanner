from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbDep
from app.data.datasets import load_builtin_datasets
from app.models import CustomDataset
from app.schemas import (
    MAX_PROMPTS_TOTAL,
    BuiltinDatasetOut,
    CustomDatasetCreate,
    CustomDatasetOut,
    DatasetsOut,
)

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.get("", response_model=DatasetsOut)
async def list_datasets(db: DbDep) -> DatasetsOut:
    builtin = [BuiltinDatasetOut.model_validate(d.model_dump()) for d in load_builtin_datasets()]
    customs = (
        await db.scalars(select(CustomDataset).order_by(CustomDataset.created_at.desc()))
    ).all()
    custom_out = [
        CustomDatasetOut(
            id=c.id,
            name=c.name,
            description=c.description,
            subcategory_count=len(c.cases),
            prompt_count=sum(len(sub["prompts"]) for sub in c.cases),
            created_at=c.created_at,
        )
        for c in customs
    ]
    return DatasetsOut(builtin=builtin, custom=custom_out)


@router.post("/custom", response_model=CustomDatasetOut, status_code=status.HTTP_201_CREATED)
async def create_custom_dataset(
    payload: CustomDatasetCreate, db: DbDep, user: CurrentUser
) -> CustomDatasetOut:
    if payload.total_prompts > MAX_PROMPTS_TOTAL:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Too many prompts ({payload.total_prompts} > {MAX_PROMPTS_TOTAL})",
        )
    existing = await db.scalar(select(CustomDataset).where(CustomDataset.name == payload.name))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="A dataset with this name already exists"
        )

    dataset = CustomDataset(
        name=payload.name,
        description=payload.description,
        cases=[sub.model_dump() for sub in payload.subcategories],
        created_by=user.id if user else None,
    )
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)
    return CustomDatasetOut(
        id=dataset.id,
        name=dataset.name,
        description=dataset.description,
        subcategory_count=len(dataset.cases),
        prompt_count=sum(len(sub["prompts"]) for sub in dataset.cases),
        created_at=dataset.created_at,
    )


@router.delete("/custom/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_dataset(dataset_id: int, db: DbDep) -> None:
    dataset = await db.get(CustomDataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    await db.delete(dataset)
    await db.commit()
