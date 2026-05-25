"""ai_settings singleton table

Revision ID: 013
Revises: 012
Create Date: 2026-05-24
"""

import sqlalchemy as sa
from alembic import op

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_settings",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("singleton_key", sa.String(), nullable=False, server_default="default"),
        sa.Column("provider", sa.String(), nullable=True),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("api_base", sa.String(), nullable=True),
        sa.Column("api_key_enc", sa.LargeBinary(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("singleton_key", name="uq_ai_settings_singleton"),
    )


def downgrade() -> None:
    op.drop_table("ai_settings")
