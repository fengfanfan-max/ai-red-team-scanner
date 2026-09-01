"""add family_id to scans for rerun history grouping

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-24
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("scans", sa.Column("family_id", sa.Integer(), nullable=True))
    op.create_index("ix_scans_family_id", "scans", ["family_id"])


def downgrade() -> None:
    op.drop_index("ix_scans_family_id", table_name="scans")
    op.drop_column("scans", "family_id")
