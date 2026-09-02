from fastapi import APIRouter

from app.engine.attacks import list_builtin_attacks
from app.schemas import AttackOut

router = APIRouter(prefix="/api/attacks", tags=["attacks"])


@router.get("", response_model=list[AttackOut])
async def list_attacks() -> list[AttackOut]:
    return [
        AttackOut(key=a.key, name=a.name, description=a.description)
        for a in list_builtin_attacks()
    ]
