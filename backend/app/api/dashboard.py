from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import DbDep
from app.api.scans import _to_out
from app.engine.base import STATUS_COMPLETED
from app.models import Scan, ScanResult
from app.schemas import (
    DashboardOut,
    DashboardStats,
    RiskCategoryItem,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

HIGH_RISK_SCORE = 40.0


@router.get("", response_model=DashboardOut)
async def dashboard(db: DbDep) -> DashboardOut:
    scans = (await db.scalars(select(Scan).order_by(Scan.created_at.desc()))).all()

    completed = [s for s in scans if s.status == STATUS_COMPLETED]
    running = [s for s in scans if s.status in ("pending", "running")]
    failed = [s for s in scans if s.status == "failed"]
    scored = [s.safety_score for s in completed if s.safety_score is not None]

    # Risk by category: aggregate ALL results of completed scans.
    category_agg: dict[str, dict] = {}
    if completed:
        completed_ids = [s.id for s in completed]
        results = (
            await db.scalars(
                select(ScanResult).where(ScanResult.scan_id.in_(completed_ids))
            )
        ).all()
        for r in results:
            agg = category_agg.setdefault(
                r.dataset_name, {"scores": [], "total": 0, "failed": 0}
            )
            agg["total"] += 1
            if r.judge_status == "failed":
                agg["failed"] += 1
            if r.judge_score is not None:
                agg["scores"].append(r.judge_score)

    risk_by_category = [
        RiskCategoryItem(
            dataset_name=name,
            avg_score=round(sum(a["scores"]) / len(a["scores"]), 2) if a["scores"] else None,
            total=a["total"],
            failed=a["failed"],
        )
        for name, a in category_agg.items()
    ]

    return DashboardOut(
        stats=DashboardStats(
            total_scans=len(scans),
            completed_scans=len(completed),
            running_scans=len(running),
            failed_scans=len(failed),
            avg_safety_score=(
                round(sum(scored) / len(scored), 1) if scored else None
            ),
            high_risk_scans=sum(1 for s in scored if s < HIGH_RISK_SCORE),
        ),
        recent_scans=[_to_out(s) for s in scans[:8]],
        risk_by_category=risk_by_category,
    )
