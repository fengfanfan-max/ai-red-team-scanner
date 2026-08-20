from datetime import datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

T = TypeVar("T")


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int | None
    email: str
    name: str
    guest: bool = False
    created_at: datetime | None = None


# ============================================
# AI Applications
# ============================================

TEXT_ONLY = ["text"]


class ApplicationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    base_url: str = Field(min_length=4, max_length=500)
    api_key: str = Field(default="", max_length=500)
    model_name: str = Field(min_length=1, max_length=200)
    input_modalities: list[str] = Field(default_factory=lambda: list(TEXT_ONLY))
    output_modalities: list[str] = Field(default_factory=lambda: list(TEXT_ONLY))


class ApplicationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    base_url: str | None = Field(default=None, min_length=4, max_length=500)
    api_key: str | None = Field(default=None, max_length=500)
    model_name: str | None = Field(default=None, min_length=1, max_length=200)
    input_modalities: list[str] | None = None
    output_modalities: list[str] | None = None


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    base_url: str
    api_key_masked: str
    model_name: str
    input_modalities: list[str]
    output_modalities: list[str]
    created_at: datetime
    updated_at: datetime


class TestChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)


class TestChatResponse(BaseModel):
    reply: str
    simulated: bool = False


# ============================================
# Datasets
# ============================================

MAX_SUBCATEGORIES = 20
MAX_PROMPTS_PER_SUBCATEGORY = 200
MAX_PROMPTS_TOTAL = 2000


class DatasetSubcategory(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    prompts: list[str] = Field(min_length=1, max_length=MAX_PROMPTS_PER_SUBCATEGORY)


class CustomDatasetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    subcategories: list[DatasetSubcategory] = Field(
        min_length=1, max_length=MAX_SUBCATEGORIES
    )

    @property
    def total_prompts(self) -> int:
        return sum(len(s.prompts) for s in self.subcategories)


class CustomDatasetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    subcategory_count: int = 0
    prompt_count: int = 0
    created_at: datetime


class BuiltinDatasetOut(BaseModel):
    name: str
    description: str
    subcategories: list[DatasetSubcategory]


class DatasetsOut(BaseModel):
    builtin: list[BuiltinDatasetOut]
    custom: list[CustomDatasetOut]


# ============================================
# Pagination
# ============================================

class Pagination(BaseModel):
    current_page: int
    page_size: int
    total_items: int
    total_pages: int
    next_page: int | None
    prev_page: int | None


class PaginatedList(BaseModel, Generic[T]):
    items: list[T]
    pagination: Pagination


# ============================================
# Judge models (reusable judge endpoints)
# ============================================

class JudgeModelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=300)
    base_url: str = Field(min_length=4, max_length=500)
    api_key: str = Field(default="", max_length=500)
    model_name: str = Field(min_length=1, max_length=200)


class JudgeModelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=300)
    base_url: str | None = Field(default=None, min_length=4, max_length=500)
    api_key: str | None = Field(default=None, max_length=500)
    model_name: str | None = Field(default=None, min_length=1, max_length=200)


class JudgeModelOut(BaseModel):
    id: int
    name: str
    description: str
    base_url: str
    api_key_masked: str
    model_name: str
    created_at: datetime
    updated_at: datetime


# ============================================
# Scans
# ============================================

class DatasetRef(BaseModel):
    source: Literal["builtin", "custom"]
    ref: str  # builtin: dataset name; custom: str(dataset id)


class JudgeConfig(BaseModel):
    """Judge selection at scan creation: reference a preset JudgeModel
    (judge_id) and/or override inline. The scan row snapshots the resolved
    config, so later judge edits never affect historical scans."""

    judge_id: int | None = None
    base_url: str | None = Field(default=None, min_length=4, max_length=500)
    model: str | None = Field(default=None, min_length=1, max_length=200)
    api_key: str = Field(default="", max_length=500)


class ScanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    application_id: int
    algorithm: str = Field(default="Default Tests", max_length=100)
    datasets: list[DatasetRef] = Field(min_length=1, max_length=20)
    concurrency: int = Field(default=4, ge=1, le=32)
    qpm: int = Field(default=60, ge=1, le=10000)
    fail_threshold: float = Field(default=5.0, ge=0, le=10)
    judge: JudgeConfig | None = None


class ScanOut(BaseModel):
    id: int
    name: str
    status: str
    application_id: int
    algorithm: str
    datasets: list[DatasetRef]
    concurrency: int
    qpm: int
    fail_threshold: float
    total_cases: int
    completed_cases: int
    passed_cases: int
    failed_cases: int
    error_cases: int
    safety_score: float | None
    error_message: str | None
    progress_pct: float
    # Judge configuration visibility (never the judge api key).
    judge_model: str | None
    judge_base_url: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class ScanProgress(BaseModel):
    id: int
    status: str
    progress_pct: float
    completed_cases: int
    total_cases: int
    passed_cases: int
    failed_cases: int
    error_cases: int
    remaining_time_s: float | None
    safety_score: float | None
    error_message: str | None


class CategorySummary(BaseModel):
    dataset_name: str
    avg_score: float | None
    passed: int
    failed: int
    errors: int
    total: int


class FailureCaseOut(BaseModel):
    dataset_name: str
    subcategory: str
    prompt: str
    answer: str | None
    judge_score: float | None
    judge_reason: str | None
    judge_status: str


class ScanCaseOut(BaseModel):
    """One evaluated case (passed, failed or errored) — full detail page rows."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    dataset_name: str
    subcategory: str
    prompt: str
    answer: str | None
    judge_score: float | None
    judge_reason: str | None
    judge_status: str
    latency_ms: int
    created_at: datetime


class ScanResultsOut(BaseModel):
    safety_score: float | None
    by_category: list[CategorySummary]
    failures: list[FailureCaseOut]


# ============================================
# Dashboard
# ============================================

class DashboardStats(BaseModel):
    total_scans: int
    completed_scans: int
    running_scans: int
    failed_scans: int
    avg_safety_score: float | None
    high_risk_scans: int


class RiskCategoryItem(BaseModel):
    dataset_name: str
    avg_score: float | None
    total: int
    failed: int


class DashboardOut(BaseModel):
    stats: DashboardStats
    recent_scans: list[ScanOut]
    risk_by_category: list[RiskCategoryItem]


TokenResponse.model_rebuild()
