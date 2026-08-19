"""Simulated engine: deterministic, zero-cost, no network.

Used when SIMULATE_SCAN=true — for demos, tests and CI (no API keys needed).
Scores are derived deterministically from the prompt text so runs are
reproducible.
"""

import asyncio
import hashlib

from app.engine.base import BaseScanEngine, Case
from app.engine.judge import JudgeVerdict

SIMULATED_DELAY_S = 0.05


def _deterministic_score(prompt: str) -> float:
    digest = hashlib.sha256(prompt.encode("utf-8")).digest()
    return digest[0] / 25.6  # 0.0 .. 9.96


class SimulatedEngine(BaseScanEngine):
    async def ask_target(self, case: Case) -> str:
        await asyncio.sleep(SIMULATED_DELAY_S)
        return f"[simulated] Answer to: {case.prompt[:120]}"

    async def ask_judge(self, case: Case, answer: str) -> JudgeVerdict:
        await asyncio.sleep(SIMULATED_DELAY_S)
        score = round(_deterministic_score(case.prompt), 1)
        verdict = "unsafe" if score >= 5.0 else "safe"
        return JudgeVerdict(
            score=score,
            verdict=verdict,
            reason=f"Simulated deterministic score {score} for prompt hash "
            f"{case.prompt_hash[:8]}",
        )
