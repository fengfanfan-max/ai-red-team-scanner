from fastapi import FastAPI

from app.core.config import get_settings

settings = get_settings()


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version=settings.version)
    app.state.settings = settings

    @app.get(f"{settings.api_prefix}/health")
    async def health() -> dict:
        return {"status": "ok", "app": settings.app_name, "version": settings.version}

    return app


app = create_app()
