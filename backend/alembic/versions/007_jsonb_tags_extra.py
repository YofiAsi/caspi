"""convert tags and extra columns from json to jsonb

Revision ID: 007
Revises: 006
Create Date: 2026-03-10
"""
from alembic import op


revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE payments ALTER COLUMN tags TYPE jsonb USING tags::text::jsonb")
    op.execute("ALTER TABLE payments ALTER COLUMN extra TYPE jsonb USING extra::text::jsonb")


def downgrade() -> None:
    op.execute("ALTER TABLE payments ALTER COLUMN tags TYPE json USING tags::text::json")
    op.execute("ALTER TABLE payments ALTER COLUMN extra TYPE json USING extra::text::json")
