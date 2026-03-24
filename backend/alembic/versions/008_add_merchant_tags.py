"""add merchant_tags table

Revision ID: 008
Revises: 007
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "merchant_tags",
        sa.Column("merchant_key", sa.String(), nullable=False),
        sa.Column("tags", JSONB(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint("merchant_key"),
    )


def downgrade() -> None:
    op.drop_table("merchant_tags")
