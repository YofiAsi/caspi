"""initial tables

Revision ID: 001
Revises:
Create Date: 2026-03-02
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "import_batches",
        sa.Column("import_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("file_name", sa.String(), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payment_count", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("import_id"),
    )
    op.create_table(
        "payments",
        sa.Column("payment_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("import_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("merchant", sa.String(), nullable=True),
        sa.Column("payment_type", sa.String(), nullable=False, server_default="unknown"),
        sa.Column("category_id", sa.UUID(as_uuid=True), nullable=True),
        sa.Column("project_id", sa.UUID(as_uuid=True), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("extra", sa.JSON(), nullable=False, server_default="{}"),
        sa.ForeignKeyConstraint(["import_id"], ["import_batches.import_id"]),
        sa.PrimaryKeyConstraint("payment_id"),
    )


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_table("import_batches")
