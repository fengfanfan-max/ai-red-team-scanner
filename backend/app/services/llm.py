"""OpenAI-compatible chat completions client (target models AND judges).

All network I/O is async (httpx) — the async red line from ADR-0003.
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

import httpx

CHAT_COMPLETIONS_TIMEOUT = httpx.Timeout(90.0, connect=10.0)

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Status codes worth retrying: transient provider issues. Everything else
# (400 content policy, 401 bad key, 403 blocked, 404, 422) is deterministic —
# retrying it just wastes calls and may draw provider scrutiny.
RETRYABLE_STATUS_CODES = {408, 409, 429, 500, 502, 503, 504}


class LLMError(Exception):
    """Raised when the target/judge model call fails (network, HTTP, parse).

    `status_code` is None for transport-level failures (timeout, DNS, ...).
    """

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code

    @property
    def retryable(self) -> bool:
        return self.status_code is None or self.status_code in RETRYABLE_STATUS_CODES

    @property
    def provider_blocked(self) -> bool:
        """Content-policy style rejection: don't retry, surface as-is."""
        return self.status_code in (400, 403)


async def retry_llm_call(
    fn: Callable[[], Awaitable[T]],
    attempts: int,
    *,
    what: str,
) -> T:
    """Call `fn` with exponential backoff, retrying ONLY transient failures.

    Deterministic provider rejections (400/403 content policy, 401 bad key)
    fail immediately — retrying them burns quota and draws platform scrutiny.
    """
    for attempt in range(attempts):
        try:
            return await fn()
        except LLMError as exc:
            if not exc.retryable or attempt == attempts - 1:
                raise
            delay = min(2**attempt, 8.0)
            logger.warning(
                "%s failed (%s, retryable) — retrying in %.1fs (%d/%d)",
                what,
                exc,
                delay,
                attempt + 1,
                attempts,
            )
            await asyncio.sleep(delay)
    raise AssertionError("unreachable")  # pragma: no cover


def build_chat_url(base_url: str) -> str:
    """Normalize an OpenAI-compatible base URL to the chat completions path.

    Accepts both `https://host/v1` and `https://host/v1/`; users are expected
    to provide a base URL in the OpenAI SDK style.
    """
    return f"{base_url.rstrip('/')}/chat/completions"


def build_auth_headers(api_key: str | None) -> dict[str, str]:
    """Content headers; Authorization is OMITTED when no key is configured.

    Local endpoints (Ollama/vLLM) do not require a key, while cloud providers
    respond 401 — the caller sees a clear error either way.
    """
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


async def chat_completion(
    base_url: str,
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
    request_timeout: httpx.Timeout = CHAT_COMPLETIONS_TIMEOUT,
) -> str:
    """Call chat/completions and return the assistant message content."""
    url = build_chat_url(base_url)
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
    }
    headers = build_auth_headers(api_key)
    try:
        async with httpx.AsyncClient(timeout=request_timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise LLMError(f"Request to {url} failed: {exc}") from exc

    if resp.status_code != 200:
        raise LLMError(
            f"Model returned HTTP {resp.status_code}: {resp.text[:300]}",
            status_code=resp.status_code,
        )

    try:
        content = resp.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError) as exc:
        raise LLMError(f"Unexpected response shape from {url}") from exc

    if not isinstance(content, str):
        raise LLMError(f"Unexpected content type from {url}: {type(content).__name__}")
    return content
