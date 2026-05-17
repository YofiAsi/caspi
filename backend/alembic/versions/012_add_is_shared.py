"""add payments.is_shared and (merchant_id, date) index

Revision ID: 012
Revises: 011
Create Date: 2026-05-17
"""

import sqlalchemy as sa
from alembic import op

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "payments",
        sa.Column("is_shared", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_payments_merchant_id_date", "payments", ["merchant_id", "date"])


def downgrade() -> None:
    op.drop_index("ix_payments_merchant_id_date", table_name="payments")
    op.drop_column("payments", "is_shared")
