"""Scan engine core: case model, shared pipeline, engine protocol.

The pipeline is shared by both engines:
- OpenAIChatEngine: real target + judge LLM calls (with retry)
- SimulatedEngine: deterministic fake answers/scores (demo/tests/CI)

Concurrency (asyncio.Semaphore) + QPM rate limiting + DB checkpoints live
here, exactly per ADR-0003.
"""

import asyncio
import hashlib
import logging
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from sqlalchemy import select

from app.core.db import SessionLocal
from app.data.datasets import load_builtin_dataset
from app.engine.judge import JudgeVerdict
from app.engine.rate_limit import TokenBucket
from app.models import CustomDataset, Scan, ScanResult

logger = logging.getLogger(__name__)

STATUS_PENDING = "pending"
STATUS_RUNNING = "running"
STATUS_FAILED = "failed"
STATUS_COMPLETED = "completed"

RESULT_PASSED = "passed"
RESULT_FAILED = "failed"
RESULT_JUDGE_ERROR = "judge_error"
RESULT_TARGET_ERROR = "target_error"

CHECKPOINT_INTERVAL_S = 5.0


def _now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True)
class Case:
    dataset_name: str
    subcategory: str
    prompt: str

    @property
    def prompt_hash(self) -> str:
        raw = f"{self.dataset_name}|{self.subcategory}|{self.prompt}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class ScanEngine(Protocol):
    def estimate_llm_calls(self, total_cases: int) -> int: ...

    async def run(self, scan_id: int) -> None: ...


class BaseScanEngine:
    """Shared pipeline: load scan/cases → concurrent processing → finalize.

    Subclasses implement the two I/O primitives:
      ask_target(case)         — target model reply (raises -> target_error)
      ask_judge(case, answer)  — judge verdict (raises -> judge_error)
    """

    def estimate_llm_calls(self, total_cases: int) -> int:
        # 1 target call + 1 judge call per case (judge may follow target).
        return total_cases * 2

    async def ask_target(self, case: Case) -> str:  # pragma: no cover - abstract
        raise NotImplementedError

    async def ask_judge(self, case: Case, answer: str) -> JudgeVerdict:  # pragma: no cover
        raise NotImplementedError

    async def prepare(self, db, scan: Scan) -> None:
        """Hook: load per-scan configuration (called once before processing).
        Subclass engines are created per-scan by the manager, so storing
        resolved config on `self` is safe."""

    @staticmethod
    async def _load_cases(db, scan: Scan) -> list[Case]:
        """Expand dataset refs into a flat list of cases."""
        cases: list[Case] = []
        for ref in scan.dataset_refs:
            if ref["source"] == "builtin":
                dataset = load_builtin_dataset(ref["ref"])
                if dataset is None:
                    raise ValueError(f"Unknown builtin dataset: {ref['ref']}")
                for sub in dataset.subcategories:
                    cases.extend(
                        Case(dataset.name, sub.name, prompt) for prompt in sub.prompts
                    )
            elif ref["source"] == "custom":
                custom = await db.get(CustomDataset, int(ref["ref"]))
                if custom is None:
                    raise ValueError(f"Unknown custom dataset: {ref['ref']}")
                for sub in custom.cases:
                    cases.extend(
                        Case(custom.name, sub["name"], prompt) for prompt in sub["prompts"]
                    )
            else:
                raise ValueError(f"Unknown dataset source: {ref['source']}")
        return cases

    async def run(self, scan_id: int) -> None:
        async with SessionLocal() as db:
            scan = await db.get(Scan, scan_id)
            if scan is None:
                logger.error("Scan %s not found; engine run aborted", scan_id)
                return
            if scan.status == STATUS_COMPLETED:
                return

            # Resume support: skip cases already processed in a previous run
            # (checkpoint rows persisted in scan_results).
            done_hashes = set(
                (
                    await db.scalars(
                        select(ScanResult.prompt_hash).where(ScanResult.scan_id == scan_id)
                    )
                ).all()
            )
            cases = [
                case
                for case in await self._load_cases(db, scan)
                if case.prompt_hash not in done_hashes
            ]

            await self.prepare(db, scan)

            scan.status = STATUS_RUNNING
            scan.started_at = scan.started_at or _now()
            await db.commit()

        sem = asyncio.Semaphore(scan.concurrency)
        bucket = TokenBucket(scan.qpm)
        started_wall = time.monotonic()

        async def process(case: Case) -> None:
            async with sem:
                await bucket.acquire()
                began = time.monotonic()
                status = RESULT_PASSED
                answer: str | None = None
                score: float | None = None
                reason: str | None = None
                try:
                    answer = await self.ask_target(case)
                except Exception as exc:  # noqa: BLE001 - one bad case must not kill the scan
                    status = RESULT_TARGET_ERROR
                    reason = str(exc)[:2000]
                    logger.warning("Target call failed for case %s: %s", case.prompt_hash, exc)
                if answer is not None:
                    try:
                        verdict = await self.ask_judge(case, answer)
                        score, reason = verdict.score, verdict.reason
                        status = (
                            RESULT_FAILED
                            if verdict.score >= scan.fail_threshold or verdict.verdict == "unsafe"
                            else RESULT_PASSED
                        )
                    except Exception as exc:  # noqa: BLE001
                        status = RESULT_JUDGE_ERROR
                        reason = str(exc)[:2000]
                        logger.warning("Judge call failed for case %s: %s", case.prompt_hash, exc)

                latency = int((time.monotonic() - began) * 1000)
                async with SessionLocal() as db:
                    db.add(
                        ScanResult(
                            scan_id=scan.id,
                            dataset_name=case.dataset_name,
                            subcategory=case.subcategory,
                            prompt=case.prompt,
                            prompt_hash=case.prompt_hash,
                            answer=answer,
                            judge_score=score,
                            judge_reason=reason,
                            judge_status=status,
                            latency_ms=latency,
                        )
                    )
                    row = await db.get(Scan, scan.id)
                    row.completed_cases += 1
                    if status == RESULT_PASSED:
                        row.passed_cases += 1
                    elif status == RESULT_FAILED:
                        row.failed_cases += 1
                    else:
                        row.error_cases += 1
                    await db.commit()

        try:
            # Chunked gather keeps memory bounded for very large datasets while
            # still saturating the concurrency window.
            chunk_size = max(1, scan.concurrency * 4)
            for i in range(0, len(cases), chunk_size):
                await asyncio.gather(*(process(c) for c in cases[i : i + chunk_size]))

            async with SessionLocal() as db:
                row = await db.get(Scan, scan.id)
                scored = (
                    await db.scalars(
                        select(ScanResult).where(
                            ScanResult.scan_id == scan.id,
                            ScanResult.judge_score.is_not(None),
                        )
                    )
                ).all()
                if scored:
                    avg = sum(r.judge_score or 0 for r in scored) / len(scored)
                    row.safety_score = round(100 * (1 - avg / 10), 1)
                row.status = STATUS_COMPLETED
                row.finished_at = _now()
                await db.commit()
            logger.info(
                "Scan %s completed in %.1fs",
                scan.id,
                time.monotonic() - started_wall,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Scan %s crashed", scan.id)
            async with SessionLocal() as db:
                row = await db.get(Scan, scan.id)
                row.status = STATUS_FAILED
                row.error_message = str(exc)[:2000]
                await db.commit()
