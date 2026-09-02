from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class User(Base):
    """A member of the single-tenant workspace (see docs/adr/0001)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AIApplication(Base):
    """Target model connection config. The api key is stored encrypted and
    never returned in API responses (masked only)."""

    __tablename__ = "ai_applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    base_url: Mapped[str] = mapped_column(String(500))
    api_key_cipher: Mapped[str] = mapped_column(Text, default="")
    model_name: Mapped[str] = mapped_column(String(200))
    input_modalities: Mapped[list] = mapped_column(JSON, default=list)
    output_modalities: Mapped[list] = mapped_column(JSON, default=list)
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class JudgeModel(Base):
    """A reusable judge endpoint config (cheap/local/cloud, OpenAI-compatible).

    Scans reference a judge by id at creation time; the scan row keeps a
    snapshot of the config, so later edits/deletes of the judge never affect
    historical scans (and the engine only ever reads the snapshot).
    """

    __tablename__ = "judge_models"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(String(300), default="")
    base_url: Mapped[str] = mapped_column(String(500))
    api_key_cipher: Mapped[str] = mapped_column(Text, default="")
    model_name: Mapped[str] = mapped_column(String(200))
    # Provider-specific request options, e.g. {"enable_thinking": false} for
    # SiliconFlow reasoning models. Merged verbatim into the payload.
    options: Mapped[dict] = mapped_column(JSON, default=dict)
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class CustomDataset(Base):
    """User-imported dataset (JSON payload, same shape as builtin files)."""

    __tablename__ = "custom_datasets"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(String(500), default="")
    cases: Mapped[list] = mapped_column(JSON)  # [{"subcategory": str, "prompts": [str]}]
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Scan(Base):
    """One evaluation run against an AI application."""

    __tablename__ = "scans"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    # Scan family: NULL = the family root (its own id identifies the family);
    # reruns inherit the root's id so a scan and its re-runs group together.
    family_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    # pending | running | failed | completed
    status: Mapped[str] = mapped_column(String(20), default="pending")
    application_id: Mapped[int] = mapped_column(
        ForeignKey("ai_applications.id", ondelete="CASCADE")
    )
    algorithm: Mapped[str] = mapped_column(String(100), default="Default Tests")
    # Selected attack modules (keys into app.engine.attacks); empty = baseline.
    attack_keys: Mapped[list] = mapped_column(JSON, default=list)
    # [{"source": "builtin" | "custom", "ref": str|int}]
    dataset_refs: Mapped[list] = mapped_column(JSON)
    concurrency: Mapped[int] = mapped_column(Integer, default=4)
    qpm: Mapped[int] = mapped_column(Integer, default=60)
    fail_threshold: Mapped[float] = mapped_column(default=5.0)
    judge_base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    judge_model: Mapped[str | None] = mapped_column(String(200), nullable=True)
    judge_api_key_cipher: Mapped[str] = mapped_column(Text, default="")
    judge_options: Mapped[dict] = mapped_column(JSON, default=dict)
    total_cases: Mapped[int] = mapped_column(Integer, default=0)
    completed_cases: Mapped[int] = mapped_column(Integer, default=0)
    passed_cases: Mapped[int] = mapped_column(Integer, default=0)
    failed_cases: Mapped[int] = mapped_column(Integer, default=0)
    error_cases: Mapped[int] = mapped_column(Integer, default=0)
    safety_score: Mapped[float | None] = mapped_column(nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ScanResult(Base):
    """Per-case outcome: prompt, target answer, judge verdict."""

    __tablename__ = "scan_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    scan_id: Mapped[int] = mapped_column(ForeignKey("scans.id", ondelete="CASCADE"), index=True)
    dataset_name: Mapped[str] = mapped_column(String(100))
    subcategory: Mapped[str] = mapped_column(String(100))
    prompt: Mapped[str] = mapped_column(Text)
    prompt_hash: Mapped[str] = mapped_column(String(64), index=True)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    judge_score: Mapped[float | None] = mapped_column(nullable=True)
    judge_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    judge_status: Mapped[str] = mapped_column(String(20))  # passed|failed|judge_error|target_error
    attack_key: Mapped[str] = mapped_column(String(40), default="default")
    # Wall time of the whole case (incl. retries), and the per-call breakdown.
    # judge_latency_ms is NULL when the refusal pre-check skipped the judge.
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    target_latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    judge_latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
