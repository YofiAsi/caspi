"""drop sharing_rules

Revision ID: 010
Revises: 009
Create Date: 2026-04-02
"""

from alembic import op

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("sharing_rules")


def downgrade() -> None:
    op.execute(
        """
        CREATE TABLE sharing_rules (
            rule_id UUID NOT NULL PRIMARY KEY,
            merchant_key VARCHAR NOT NULL,
            share_type VARCHAR NOT NULL,
            share_value NUMERIC(12, 4) NOT NULL,
            currency VARCHAR(3) NOT NULL,
            label VARCHAR,
            created_at TIMESTAMPTZ NOT NULL
        )
        """
    )
