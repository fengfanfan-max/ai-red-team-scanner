from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbDep, SettingsDep
from app.core.crypto import encrypt_api_key
from app.data.datasets import load_builtin_dataset
from app.engine.manager import get_engine_manager
from app.models import AIApplication, CustomDataset, JudgeModel, Scan, ScanResult
from app.schemas import (
    CategorySummary,
    DatasetRef,
    FailureCaseOut,
    PaginatedList,
    Pagination,
    ScanCaseOut,
    ScanCreate,
    ScanOut,
    ScanProgress,
    ScanResultsOut,
)

router = APIRouter(prefix="/api/scans", tags=["scans"])


def _progress_pct(scan: Scan) -> float:
    if scan.total_cases == 0:
        return 0.0
    return round(scan.completed_cases / scan.total_cases * 100, 1)


def _to_out(scan: Scan) -> ScanOut:
    return ScanOut(
        id=scan.id,
        name=scan.name,
        status=scan.status,
        application_id=scan.application_id,
        algorithm=scan.algorithm,
        datasets=[DatasetRef.model_validate(ref) for ref in scan.dataset_refs],
        concurrency=scan.concurrency,
        qpm=scan.qpm,
        fail_threshold=scan.fail_threshold,
        total_cases=scan.total_cases,
        completed_cases=scan.completed_cases,
        passed_cases=scan.passed_cases,
        failed_cases=scan.failed_cases,
        error_cases=scan.error_cases,
        safety_score=scan.safety_score,
        error_message=scan.error_message,
        progress_pct=_progress_pct(scan),
        judge_model=scan.judge_model,
        judge_base_url=scan.judge_base_url,
        created_at=scan.created_at,
        started_at=scan.started_at,
        finished_at=scan.finished_at,
    )


async def _expand_refs(db, refs: list[DatasetRef]) -> tuple[list, int]:
    """Validate dataset refs and count total cases."""
    cases: list = []
    for ref in refs:
        if ref.source == "builtin":
            dataset = load_builtin_dataset(ref.ref)
            if dataset is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Unknown builtin dataset: {ref.ref}",
                )
            cases.extend(dataset.subcategories)
        else:
            custom = await db.get(CustomDataset, int(ref.ref))
            if custom is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Unknown custom dataset: {ref.ref}",
                )
            cases.extend(custom.cases)
    total = sum(len(sub["prompts"]) if isinstance(sub, dict) else len(sub.prompts) for sub in cases)
    return cases, total


@router.post("", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
async def create_scan(
    payload: ScanCreate, db: DbDep, settings: SettingsDep, user: CurrentUser
) -> ScanOut:
    app = await db.get(AIApplication, payload.application_id)
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    _, total = await _expand_refs(db, payload.datasets)
    if total == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="No cases to scan"
        )

    judge_base_url: str | None = None
    judge_model: str | None = None
    judge_api_key_cipher: str = ""
    if payload.judge is not None:
        # Reference a preset JudgeModel (snapshot its config)…
        if payload.judge.judge_id is not None:
            preset = await db.get(JudgeModel, payload.judge.judge_id)
            if preset is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Judge not found"
                )
            judge_base_url = preset.base_url
            judge_model = preset.model_name
            # Ciphertext copied as-is — never decrypted in this path.
            judge_api_key_cipher = preset.api_key_cipher
        # …with inline overrides applied on top.
        if payload.judge.base_url is not None:
            judge_base_url = payload.judge.base_url
        if payload.judge.model is not None:
            judge_model = payload.judge.model
        if payload.judge.api_key:
            judge_api_key_cipher = encrypt_api_key(payload.judge.api_key, settings)

    scan = Scan(
        name=payload.name,
        application_id=payload.application_id,
        algorithm=payload.algorithm,
        dataset_refs=[ref.model_dump() for ref in payload.datasets],
        concurrency=payload.concurrency,
        qpm=payload.qpm,
        fail_threshold=payload.fail_threshold,
        judge_base_url=judge_base_url,
        judge_model=judge_model,
        judge_api_key_cipher=judge_api_key_cipher,
        total_cases=total,
        created_by=user.id if user else None,
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)

    get_engine_manager(settings).start(scan.id)
    return _to_out(scan)


@router.post("/{scan_id}/rerun", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
async def rerun_scan(
    scan_id: int, db: DbDep, settings: SettingsDep, user: CurrentUser
) -> ScanOut:
    """Re-run a scan: create a NEW scan from the original's configuration.

    Fully independent of the original (fresh id, fresh results). The judge
    api key is copied as ciphertext — never decrypted or re-exposed.
    """
    original = await db.get(Scan, scan_id)
    if original is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    # Configuration snapshot; counters/status/results intentionally NOT copied.
    scan = Scan(
        name=f"{original.name} (rerun)",
        application_id=original.application_id,
        algorithm=original.algorithm,
        dataset_refs=original.dataset_refs,
        concurrency=original.concurrency,
        qpm=original.qpm,
        fail_threshold=original.fail_threshold,
        judge_base_url=original.judge_base_url,
        judge_model=original.judge_model,
        judge_api_key_cipher=original.judge_api_key_cipher,
        total_cases=original.total_cases,
        created_by=user.id if user else None,
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)

    get_engine_manager(settings).start(scan.id)
    return _to_out(scan)


@router.get("", response_model=PaginatedList[ScanOut])
async def list_scans(
    db: DbDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    scan_status: str | None = Query(default=None, alias="status"),
) -> PaginatedList[ScanOut]:
    stmt = select(Scan)
    if scan_status:
        stmt = stmt.where(Scan.status == scan_status)
    stmt = stmt.order_by(Scan.created_at.desc())

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (
        await db.scalars(
            stmt.offset((page - 1) * page_size).limit(page_size)
        )
    ).all()
    total_pages = (total + page_size - 1) // page_size if total else 1
    return PaginatedList(
        items=[_to_out(s) for s in rows],
        pagination=Pagination(
            current_page=page,
            page_size=page_size,
            total_items=total,
            total_pages=total_pages,
            next_page=page + 1 if page < total_pages else None,
            prev_page=page - 1 if page > 1 else None,
        ),
    )


@router.get("/{scan_id}", response_model=ScanOut)
async def get_scan(scan_id: int, db: DbDep) -> ScanOut:
    scan = await db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    return _to_out(scan)


@router.get("/{scan_id}/progress", response_model=ScanProgress)
async def get_scan_progress(scan_id: int, db: DbDep) -> ScanProgress:
    scan = await db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    remaining: float | None = None
    if (
        scan.status in ("pending", "running")
        and scan.completed_cases > 0
        and scan.started_at is not None
    ):
        started = scan.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=UTC)
        elapsed_s = (datetime.now(UTC) - started).total_seconds()
        if elapsed_s > 0:
            rate = scan.completed_cases / elapsed_s
            remaining = (
                round((scan.total_cases - scan.completed_cases) / rate, 1) if rate > 0 else None
            )

    return ScanProgress(
        id=scan.id,
        status=scan.status,
        progress_pct=_progress_pct(scan),
        completed_cases=scan.completed_cases,
        total_cases=scan.total_cases,
        passed_cases=scan.passed_cases,
        failed_cases=scan.failed_cases,
        error_cases=scan.error_cases,
        remaining_time_s=remaining,
        safety_score=scan.safety_score,
        error_message=scan.error_message,
    )


@router.get("/{scan_id}/cases", response_model=PaginatedList[ScanCaseOut])
async def list_scan_cases(
    scan_id: int,
    db: DbDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    case_status: str | None = Query(default=None, alias="status"),
) -> PaginatedList[ScanCaseOut]:
    """Full per-case list (passed, failed and errored) with pagination."""
    scan = await db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    stmt = select(ScanResult).where(ScanResult.scan_id == scan_id)
    if case_status == "errors":
        stmt = stmt.where(ScanResult.judge_status.in_(["judge_error", "target_error"]))
    elif case_status in ("passed", "failed"):
        stmt = stmt.where(ScanResult.judge_status == case_status)
    elif case_status not in (None, "all"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Unknown status filter: {case_status}",
        )
    stmt = stmt.order_by(ScanResult.id.desc())

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))).all()
    total_pages = (total + page_size - 1) // page_size if total else 1
    return PaginatedList(
        items=[ScanCaseOut.model_validate(r) for r in rows],
        pagination=Pagination(
            current_page=page,
            page_size=page_size,
            total_items=total,
            total_pages=total_pages,
            next_page=page + 1 if page < total_pages else None,
            prev_page=page - 1 if page > 1 else None,
        ),
    )


@router.get("/{scan_id}/results", response_model=ScanResultsOut)
async def get_scan_results(scan_id: int, db: DbDep) -> ScanResultsOut:
    scan = await db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    results = (
        await db.scalars(select(ScanResult).where(ScanResult.scan_id == scan_id))
    ).all()

    by_category: list[CategorySummary] = []
    failures: list[FailureCaseOut] = []
    for r in results:
        if r.judge_status in ("failed", "target_error"):
            failures.append(
                FailureCaseOut(
                    dataset_name=r.dataset_name,
                    subcategory=r.subcategory,
                    prompt=r.prompt,
                    answer=r.answer,
                    judge_score=r.judge_score,
                    judge_reason=r.judge_reason,
                    judge_status=r.judge_status,
                )
            )

    for dataset_name in {r.dataset_name for r in results}:
        rows = [r for r in results if r.dataset_name == dataset_name]
        scored = [r.judge_score for r in rows if r.judge_score is not None]
        by_category.append(
            CategorySummary(
                dataset_name=dataset_name,
                avg_score=round(sum(scored) / len(scored), 2) if scored else None,
                passed=sum(1 for r in rows if r.judge_status == "passed"),
                failed=sum(1 for r in rows if r.judge_status == "failed"),
                errors=sum(1 for r in rows if r.judge_status in ("judge_error", "target_error")),
                total=len(rows),
            )
        )

    failures.sort(key=lambda f: (f.judge_score is None, -(f.judge_score or 0)))
    return ScanResultsOut(
        safety_score=scan.safety_score,
        by_category=by_category,
        failures=failures,
    )
