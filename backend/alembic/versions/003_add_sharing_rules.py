"""add sharing rules and payment share columns

Revision ID: 003
Revises: 002
Create Date: 2026-03-02
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("share_amount", sa.Numeric(12, 2), nullable=True))
    op.add_column("payments", sa.Column("share_currency", sa.String(3), nullable=True))

    op.create_table(
        "sharing_rules",
        sa.Column("rule_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("merchant_key", sa.String(), nullable=False),
        sa.Column("share_type", sa.String(), nullable=False),
        sa.Column("share_value", sa.Numeric(12, 4), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("rule_id"),
    )


def downgrade() -> None:
    op.drop_table("sharing_rules")
    op.drop_column("payments", "share_currency")
    op.drop_column("payments", "share_amount")
