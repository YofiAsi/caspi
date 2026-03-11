"""remove projects table and project_id from payments

Revision ID: 006
Revises: 005
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa


revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("payments", "project_id")
    op.drop_table("projects")


def downgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("project_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("project_id"),
    )
    op.add_column(
        "payments",
        sa.Column("project_id", sa.UUID(as_uuid=True), nullable=True),
    )
