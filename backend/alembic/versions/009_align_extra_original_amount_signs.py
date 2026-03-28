"""align extra.original_amount sign with payment amount for foreign currency

Revision ID: 009
Revises: 008
Create Date: 2026-03-28
"""
import json
from decimal import Decimal

import sqlalchemy as sa
from alembic import op

from caspi.application.scrape_isracard import aligned_original_amount_for_store

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            """
            SELECT payment_id, amount, currency, extra
            FROM payments
            WHERE extra ? 'original_amount'
              AND extra ? 'original_currency'
              AND upper(trim(extra->>'original_currency')) <> upper(trim(currency))
            """
        )
    ).mappings().all()

    for row in rows:
        extra = dict(row["extra"])
        raw_oa = extra.get("original_amount")
        if raw_oa is None:
            continue
        charged = row["amount"]
        if not isinstance(charged, Decimal):
            charged = Decimal(str(charged))
        new_oa = aligned_original_amount_for_store(charged, raw_oa)
        if new_oa is None:
            continue
        try:
            old_dec = Decimal(str(raw_oa)).quantize(Decimal("0.01"))
            new_dec = Decimal(str(new_oa)).quantize(Decimal("0.01"))
            if old_dec == new_dec:
                continue
        except Exception:
            pass
        extra["original_amount"] = new_oa
        conn.execute(
            sa.text("UPDATE payments SET extra = CAST(:ex AS jsonb) WHERE payment_id = :pid"),
            {"ex": json.dumps(extra), "pid": row["payment_id"]},
        )


def downgrade() -> None:
    pass
