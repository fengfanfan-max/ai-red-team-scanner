"""Real LLM engine: OpenAI-compatible target + judge calls (with retry).

Engine instances are created PER SCAN by the manager, so per-scan config
resolved in `prepare()` can live on `self` without cross-scan races.
"""

from dataclasses import dataclass

from app.core.config import Settings
from app.core.crypto import decrypt_api_key
from app.engine.base import BaseScanEngine, Case
from app.engine.judge import JudgeVerdict, build_judge_messages, parse_judge_response
from app.models import AIApplication, Scan
from app.services.llm import chat_completion, retry_llm_call

TARGET_ATTEMPTS = 3
JUDGE_ATTEMPTS = 3


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

        return await retry_llm_call(
            lambda: chat_completion(
                self._target.base_url,
                self._target.api_key or "",
                self._target.model,
                [{"role": "user", "content": case.prompt}],
            ),
            attempts=TARGET_ATTEMPTS,
            what=f"target call (scan case {case.prompt_hash[:8]})",
        )

    async def ask_judge(self, case: Case, answer: str) -> JudgeVerdict:
        assert self._judge is not None, "prepare() must run before ask_judge()"

        async def _judge_call() -> str:
            return await chat_completion(
                self._judge.base_url,
                self._judge.api_key or "",
                self._judge.model,
                build_judge_messages(case.prompt, answer),
            )

        raw = await retry_llm_call(
            _judge_call,
            attempts=JUDGE_ATTEMPTS,
            what=f"judge call (scan case {case.prompt_hash[:8]})",
        )
        return parse_judge_response(raw)
