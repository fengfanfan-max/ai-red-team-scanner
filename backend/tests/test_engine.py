import time

import pytest

from app.engine.base import Case
from app.engine.judge import JudgeParseError, build_judge_messages, parse_judge_response
from app.engine.rate_limit import TokenBucket
from app.engine.simulated_engine import SimulatedEngine, _deterministic_score


@pytest.mark.asyncio
async def test_token_bucket_allows_qpm_per_minute() -> None:
    """qpm=600 → 10 tokens/s; after the burst, 10 more tokens need ~1s."""
    bucket = TokenBucket(qpm=600)
    start = time.monotonic()
    for _ in range(610):
        await bucket.acquire()
    elapsed = time.monotonic() - start
    assert elapsed >= 1.0
    assert elapsed < 10.0


@pytest.mark.asyncio
async def test_token_bucket_never_allows_more_than_capacity_at_once() -> None:
    bucket = TokenBucket(qpm=60)
    start = time.monotonic()
    for _ in range(60):
        await bucket.acquire()
    # burst of 60 is allowed instantly
    assert time.monotonic() - start < 1.0


def test_judge_parses_clean_json() -> None:
    verdict = parse_judge_response('{"score": 7, "verdict": "unsafe", "reason": "harmful"}')
    assert verdict.score == 7
    assert verdict.verdict == "unsafe"
    assert verdict.reason == "harmful"


def test_judge_parses_markdown_fenced_json() -> None:
    raw = '```json\n{"score": 2, "verdict": "safe", "reason": "ok"}\n```'
    verdict = parse_judge_response(raw)
    assert verdict.score == 2
    assert verdict.verdict == "safe"


def test_judge_rejects_bad_outputs() -> None:
    with pytest.raises(JudgeParseError):
        parse_judge_response("I cannot evaluate that.")
    with pytest.raises(JudgeParseError):
        parse_judge_response('{"score": 11, "verdict": "safe", "reason": "x"}')
    with pytest.raises(JudgeParseError):
        parse_judge_response('{"score": 3, "verdict": "maybe", "reason": "x"}')


def test_judge_messages_contain_prompt_and_answer() -> None:
    messages = build_judge_messages("prompt", "answer")
    assert messages[0]["role"] == "system"
    assert "prompt" in messages[1]["content"]
    assert "answer" in messages[1]["content"]


@pytest.mark.asyncio
async def test_simulated_engine_is_deterministic() -> None:
    engine = SimulatedEngine()
    case = Case(dataset_name="D", subcategory="S", prompt="test prompt")
    answer = await engine.ask_target(case)
    verdict1 = await engine.ask_judge(case, answer)
    verdict2 = await engine.ask_judge(case, answer)
    assert verdict1 == verdict2
    assert 0 <= verdict1.score <= 10
    assert verdict1.verdict in ("safe", "unsafe")
    assert "test prompt" in answer


def test_simulated_score_reproducible() -> None:
    assert _deterministic_score("same prompt") == _deterministic_score("same prompt")
    assert 0 <= _deterministic_score("x") < 10


def test_case_prompt_hash_stable() -> None:
    c1 = Case("D", "S", "p")
    c2 = Case("D", "S", "p")
    c3 = Case("D", "S", "other")
    assert c1.prompt_hash == c2.prompt_hash
    assert c1.prompt_hash != c3.prompt_hash
