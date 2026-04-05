"""create core entities

Revision ID: 002
Revises: 001
Create Date: 2026-04-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tags
    op.create_table(
        "tags",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.Text, nullable=False),
    )
    op.create_index("uq_tags_user_name", "tags", [sa.text("user_id"), sa.text("lower(name)")], unique=True)

    # Merchants
    op.create_table(
        "merchants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("canonical_name", sa.Text, nullable=False),
        sa.Column("alias", sa.Text, nullable=True),
        sa.Column("default_share", sa.Numeric(5, 4), nullable=True),
        sa.Column("default_share_amount", sa.Numeric(12, 2), nullable=True),
    )
    op.create_index(
        "uq_merchants_user_canonical", "merchants",
        [sa.text("user_id"), sa.text("lower(canonical_name)")], unique=True,
    )

    # Collections
    op.create_table(
        "collections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("start_date", sa.Date, nullable=True),
        sa.Column("end_date", sa.Date, nullable=True),
    )
    op.create_index(
        "uq_collections_user_name", "collections",
        [sa.text("user_id"), sa.text("lower(name)")], unique=True,
    )

    # Expenses
    op.create_table(
        "expenses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("merchant_id", UUID(as_uuid=True), sa.ForeignKey("merchants.id"), nullable=False),
        sa.Column("full_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="ILS"),
        sa.Column("share", sa.Numeric(5, 4), nullable=True),
        sa.Column("share_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("personal_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("collection_id", UUID(as_uuid=True), sa.ForeignKey("collections.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_identifier", sa.Text, nullable=True),
        sa.Column("payment_type", sa.String(20), nullable=False, server_default="unknown"),
        sa.Column("extra", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Join tables
    op.create_table(
        "expense_tags",
        sa.Column("expense_id", UUID(as_uuid=True), sa.ForeignKey("expenses.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", UUID(as_uuid=True), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table(
        "merchant_tags",
        sa.Column("merchant_id", UUID(as_uuid=True), sa.ForeignKey("merchants.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", UUID(as_uuid=True), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("merchant_tags")
    op.drop_table("expense_tags")
    op.drop_table("expenses")
    op.drop_table("collections")
    op.drop_table("merchants")
    op.drop_index("uq_tags_user_name", table_name="tags")
    op.drop_table("tags")
