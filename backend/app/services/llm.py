"""OpenAI-compatible chat completions client (target models AND judges).

All network I/O is async (httpx) — the async red line from ADR-0003.
"""

from typing import Any

import httpx

CHAT_COMPLETIONS_TIMEOUT = httpx.Timeout(90.0, connect=10.0)


class LLMError(Exception):
    """Raised when the target/judge model call fails (network, HTTP, parse)."""


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
        raise LLMError(f"Model returned HTTP {resp.status_code}: {resp.text[:300]}")

    try:
        content = resp.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError) as exc:
        raise LLMError(f"Unexpected response shape from {url}") from exc

    if not isinstance(content, str):
        raise LLMError(f"Unexpected content type from {url}: {type(content).__name__}")
    return content
