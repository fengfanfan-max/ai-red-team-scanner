import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.auth import router as auth_router
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.auth_mode != "disabled" and settings.jwt_secret.startswith("dev-only-secret"):
        logger.warning("JWT_SECRET is the default dev value — set it in production!")
    yield


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)
    app.state.settings = settings

    app.include_router(auth_router)

    @app.get(f"{settings.api_prefix}/health")
    async def health() -> dict:
        return {"status": "ok", "app": settings.app_name, "version": settings.version}

    return app


app = create_app()
