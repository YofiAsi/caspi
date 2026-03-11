"""add source_identifier to payments

Revision ID: 002
Revises: 001
Create Date: 2026-03-02
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("source_identifier", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("payments", "source_identifier")
