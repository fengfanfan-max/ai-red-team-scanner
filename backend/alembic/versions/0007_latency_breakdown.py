"""add per-call latency breakdown to scan_results

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-24
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("scan_results", sa.Column("target_latency_ms", sa.Integer(), nullable=True))
    op.add_column("scan_results", sa.Column("judge_latency_ms", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("scan_results", "judge_latency_ms")
    op.drop_column("scan_results", "target_latency_ms")
