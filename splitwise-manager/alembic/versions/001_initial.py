"""initial splitwise manager tables

Revision ID: 001
Revises:
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "001"
down_revision = None
branch_labels = None
depends_on = None

SCHEMA = "splitwise"


def upgrade() -> None:
    op.execute(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"')

    op.create_table(
        "credentials",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("singleton_key", sa.String(), nullable=False, server_default="default"),
        sa.Column("consumer_key_enc", sa.LargeBinary(), nullable=False),
        sa.Column("consumer_secret_enc", sa.LargeBinary(), nullable=False),
        sa.Column("api_key_enc", sa.LargeBinary(), nullable=False),
        sa.Column("splitwise_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("singleton_key", name="uq_credentials_singleton"),
        schema=SCHEMA,
    )

    op.create_table(
        "merchant_share_rules",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("merchant_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("splitwise_group_id", sa.Integer(), nullable=False),
        sa.Column("split_method", sa.String(), nullable=False),
        sa.Column("split_params", JSONB(), nullable=False, server_default="{}"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="ILS"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("merchant_id", name="uq_merchant_share_rule_merchant"),
        schema=SCHEMA,
    )

    op.create_table(
        "payment_splitwise_links",
        sa.Column("payment_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("splitwise_expense_id", sa.BigInteger(), nullable=True),
        sa.Column("splitwise_group_id", sa.Integer(), nullable=False),
        sa.Column("pushed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.PrimaryKeyConstraint("payment_id"),
        schema=SCHEMA,
    )

    op.create_table(
        "outbox",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("payment_id", sa.UUID(as_uuid=True), nullable=True),
        sa.Column("operation", sa.String(), nullable=False),
        sa.Column("payload", JSONB(), nullable=False, server_default="{}"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="queued"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index("ix_outbox_payment_id", "outbox", ["payment_id"], schema=SCHEMA)
    op.create_index("ix_outbox_status", "outbox", ["status"], schema=SCHEMA)
    op.create_index("ix_outbox_next_attempt_at", "outbox", ["next_attempt_at"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_index("ix_outbox_next_attempt_at", table_name="outbox", schema=SCHEMA)
    op.drop_index("ix_outbox_status", table_name="outbox", schema=SCHEMA)
    op.drop_index("ix_outbox_payment_id", table_name="outbox", schema=SCHEMA)
    op.drop_table("outbox", schema=SCHEMA)
    op.drop_table("payment_splitwise_links", schema=SCHEMA)
    op.drop_table("merchant_share_rules", schema=SCHEMA)
    op.drop_table("credentials", schema=SCHEMA)
    op.execute(f'DROP SCHEMA IF EXISTS "{SCHEMA}"')
