"""add options columns for judge presets and scan snapshots

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-24
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "judge_models",
        sa.Column("options", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )
    op.add_column(
        "scans",
        sa.Column("judge_options", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )


def downgrade() -> None:
    op.drop_column("scans", "judge_options")
    op.drop_column("judge_models", "options")
