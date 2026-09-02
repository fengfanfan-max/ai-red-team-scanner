"""add attack modules columns to scans and scan_results

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-24
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "scans",
        sa.Column("attack_keys", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
    )
    op.add_column(
        "scan_results",
        sa.Column(
            "attack_key", sa.String(length=40), nullable=False, server_default=sa.text("'default'")
        ),
    )


def downgrade() -> None:
    op.drop_column("scan_results", "attack_key")
    op.drop_column("scans", "attack_keys")
