"""add merchant aliases table

Revision ID: 005
Revises: 004
Create Date: 2026-03-02
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "merchant_aliases",
        sa.Column("original_merchant", sa.String(), nullable=False),
        sa.Column("alias", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("original_merchant"),
    )


def downgrade() -> None:
    op.drop_table("merchant_aliases")
