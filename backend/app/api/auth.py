from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbDep, SettingsDep
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

GUEST = UserOut(id=None, email="guest@local", name="Local User (no-auth)", guest=True)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: DbDep, settings: SettingsDep) -> TokenResponse:
    existing = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=payload.email.lower(),
        name=payload.name,
        password_hash=await hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = await create_access_token(user.id, settings)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: DbDep, settings: SettingsDep) -> TokenResponse:
    user = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not await verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    token = await create_access_token(user.id, settings)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout() -> None:
    """Stateless JWT: the client simply discards its token."""
    return None


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser, settings: SettingsDep) -> UserOut:
    if user is None:
        if settings.auth_disabled:
            return GUEST
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return UserOut.model_validate(user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest, user: CurrentUser, db: DbDep, settings: SettingsDep
) -> None:
    if user is None:
        if settings.auth_disabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No user to change password for (auth disabled)",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not await verify_password(payload.old_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Old password is wrong")

    user.password_hash = await hash_password(payload.new_password)
    await db.commit()
