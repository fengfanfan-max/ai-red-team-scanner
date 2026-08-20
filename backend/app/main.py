import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.applications import router as applications_router
from app.api.auth import router as auth_router
from app.api.dashboard import router as dashboard_router
from app.api.datasets import router as datasets_router
from app.api.judges import router as judges_router
from app.api.scans import router as scans_router
from app.core.config import get_settings
from app.engine.manager import get_engine_manager

# Engine/manager loggers must be visible by default (uvicorn does not
# configure the root logger); otherwise background-task errors vanish.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.auth_mode != "disabled" and settings.jwt_secret.startswith("dev-only-secret"):
        logger.warning("JWT_SECRET is the default dev value — set it in production!")
    # Resume interrupted scans from DB checkpoints (ADR-0003).
    await get_engine_manager(settings).recover()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)
    app.state.settings = settings

    app.include_router(auth_router)
    app.include_router(applications_router)
    app.include_router(datasets_router)
    app.include_router(judges_router)
    app.include_router(scans_router)
    app.include_router(dashboard_router)

    @app.get(f"{settings.api_prefix}/health")
    async def health() -> dict:
        return {"status": "ok", "app": settings.app_name, "version": settings.version}

    return app


app = create_app()
