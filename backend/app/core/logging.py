"""Centralized logging setup.

- Structured, uniform line format: timestamp level logger: message
- Level controlled by LOG_LEVEL (default INFO; DEBUG for deep debugging)
- Optional file output with rotation via LOG_FILE (default: stdout only)
"""

import logging
import os
from logging.handlers import RotatingFileHandler

LOGGER_NAME = "app"
LOG_FORMAT = "%(asctime)s %(levelname)-7s %(name)s: %(message)s"


def setup_logging() -> None:
    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()

    formatter = logging.Formatter(LOG_FORMAT)

    # stdout handler (docker/dev default)
    stream = logging.StreamHandler()
    stream.setFormatter(formatter)
    root.addHandler(stream)

    # optional rotating file handler (LOG_FILE=/path/app.log)
    log_file = os.environ.get("LOG_FILE")
    if log_file:
        file_handler = RotatingFileHandler(
            log_file, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)

    # uvicorn access logs are noisy at DEBUG; keep them at WARNING unless
    # explicitly debugging the server itself.
    logging.getLogger("uvicorn.access").setLevel(max(level, logging.WARNING))
