"""Request logging middleware: one line per request with status + duration,
plus an exception hook that binds the failing request to its traceback."""

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("app.request")

# Paths that spam the log with little value.
NOISY_PATHS = ("/api/health",)


class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        if path in NOISY_PATHS:
            return await call_next(request)

        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - started) * 1000
            logger.exception(
                "500 %s %s (%.0fms) — unhandled exception",
                request.method,
                path,
                elapsed_ms,
            )
            raise
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.info(
            "%s %s %d (%.0fms)",
            request.method,
            path,
            response.status_code,
            elapsed_ms,
        )
        return response
