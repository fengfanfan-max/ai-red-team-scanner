"""Real LLM engine: OpenAI-compatible target + judge calls (with retry).

Engine instances are created PER SCAN by the manager, so per-scan config
resolved in `prepare()` can live on `self` without cross-scan races.
"""

import asyncio
from dataclasses import dataclass

from app.core.config import Settings
from app.core.crypto import decrypt_api_key
from app.engine.base import BaseScanEngine, Case
from app.engine.judge import JudgeVerdict, build_judge_messages, parse_judge_response
from app.models import AIApplication, Scan
from app.services.llm import LLMError, chat_completion

TARGET_RETRIES = 1
JUDGE_RETRIES = 1


@dataclass(frozen=True)
class _Endpoint:
    base_url: str
    model: str
    api_key: str | None


class OpenAIChatEngine(BaseScanEngine):
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._target: _Endpoint | None = None
        self._judge: _Endpoint | None = None

    async def prepare(self, db, scan: Scan) -> None:
        app = await db.get(AIApplication, scan.application_id)
        if app is None:
            raise ValueError(f"Application {scan.application_id} no longer exists")

        target_key = (
            decrypt_api_key(app.api_key_cipher, self.settings) if app.api_key_cipher else None
        )
        self._target = _Endpoint(app.base_url, app.model_name, target_key)

        if scan.judge_base_url and scan.judge_model:
            judge_key = (
                decrypt_api_key(scan.judge_api_key_cipher, self.settings)
                if scan.judge_api_key_cipher
                else None
            )
            self._judge = _Endpoint(scan.judge_base_url, scan.judge_model, judge_key)
        else:
            # Default: judge follows the target endpoint (documented trade-off:
            # users are guided to configure a cheaper/local judge instead).
            self._judge = self._target

    async def ask_target(self, case: Case) -> str:
        assert self._target is not None, "prepare() must run before ask_target()"
        if not self._target.api_key:
            raise LLMError("Target application has no API key configured")

        messages = [{"role": "user", "content": case.prompt}]
        last_error: Exception | None = None
        for attempt in range(TARGET_RETRIES + 1):
            try:
                return await chat_completion(
                    self._target.base_url,
                    self._target.api_key,
                    self._target.model,
                    messages,
                )
            except LLMError as exc:
                last_error = exc
                await asyncio.sleep(0.5 * (attempt + 1))
        raise last_error  # type: ignore[misc]

    async def ask_judge(self, case: Case, answer: str) -> JudgeVerdict:
        assert self._judge is not None, "prepare() must run before ask_judge()"
        if not self._judge.api_key:
            raise LLMError("Judge endpoint has no API key configured")

        messages = build_judge_messages(case.prompt, answer)
        last_error: Exception | None = None
        for attempt in range(JUDGE_RETRIES + 1):
            try:
                raw = await chat_completion(
                    self._judge.base_url,
                    self._judge.api_key,
                    self._judge.model,
                    messages,
                )
                return parse_judge_response(raw)
            except (LLMError, Exception) as exc:  # noqa: BLE001 - parse errors also retried
                last_error = exc
                await asyncio.sleep(0.5 * (attempt + 1))
        raise last_error  # type: ignore[misc]
