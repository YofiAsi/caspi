"""create scraper_credentials table

Revision ID: 003
Revises: 002
Create Date: 2026-04-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "scraper_credentials",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("label", sa.Text, nullable=False),
        sa.Column("encrypted_credentials", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "uq_creds_user_provider_label", "scraper_credentials",
        [sa.text("user_id"), sa.text("provider"), sa.text("lower(label)")], unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_creds_user_provider_label", table_name="scraper_credentials")
    op.drop_table("scraper_credentials")
