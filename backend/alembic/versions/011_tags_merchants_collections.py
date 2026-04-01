"""tags, merchants, collections; backfill; drop legacy merchant/tag columns

Revision ID: 011
Revises: 010
Create Date: 2026-04-02
"""

import sqlalchemy as sa
from alembic import op

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tags",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "merchants",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("canonical_name", sa.String(), nullable=False),
        sa.Column("alias", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("canonical_name"),
    )
    op.create_table(
        "collections",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "payment_tags",
        sa.Column("payment_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("tag_id", sa.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["payment_id"], ["payments.payment_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("payment_id", "tag_id"),
    )
    op.create_table(
        "merchant_tag_links",
        sa.Column("merchant_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("tag_id", sa.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("merchant_id", "tag_id"),
    )
    op.create_table(
        "payment_collections",
        sa.Column("payment_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("collection_id", sa.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["payment_id"], ["payments.payment_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["collection_id"], ["collections.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("payment_id", "collection_id"),
    )
    op.create_index("ix_payment_tags_tag_id", "payment_tags", ["tag_id"])
    op.create_index("ix_merchant_tag_links_tag_id", "merchant_tag_links", ["tag_id"])
    op.create_index("ix_payment_collections_collection_id", "payment_collections", ["collection_id"])

    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            INSERT INTO tags (id, name)
            SELECT gen_random_uuid(), LOWER(TRIM(elem::text))
            FROM (
                SELECT DISTINCT jsonb_array_elements_text(COALESCE(p.tags, '[]'::jsonb)) AS elem
                FROM payments p
                UNION
                SELECT DISTINCT jsonb_array_elements_text(COALESCE(mt.tags, '[]'::jsonb))
                FROM merchant_tags mt
            ) x
            WHERE TRIM(elem::text) <> ''
            ON CONFLICT (name) DO NOTHING
            """
        )
    )
    conn.execute(
        sa.text(
            """
            INSERT INTO merchants (id, canonical_name, alias)
            SELECT gen_random_uuid(), c.canon, a.alias
            FROM (
                SELECT DISTINCT LOWER(TRIM(COALESCE(NULLIF(TRIM(merchant), ''), description))) AS canon
                FROM payments
            ) c
            LEFT JOIN LATERAL (
                SELECT ma.alias
                FROM merchant_aliases ma
                WHERE LOWER(TRIM(ma.original_merchant)) = c.canon
                ORDER BY ma.original_merchant
                LIMIT 1
            ) a ON true
            """
        )
    )
    conn.execute(
        sa.text(
            """
            INSERT INTO payment_tags (payment_id, tag_id)
            SELECT DISTINCT p.payment_id, t.id
            FROM payments p
            CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.tags, '[]'::jsonb)) AS elem
            INNER JOIN tags t ON t.name = LOWER(TRIM(elem::text))
            WHERE TRIM(elem::text) <> ''
            ON CONFLICT DO NOTHING
            """
        )
    )
    conn.execute(
        sa.text(
            """
            INSERT INTO merchant_tag_links (merchant_id, tag_id)
            SELECT DISTINCT m.id, t.id
            FROM merchant_tags mt
            INNER JOIN merchants m ON m.canonical_name = LOWER(TRIM(mt.merchant_key))
            CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(mt.tags, '[]'::jsonb)) AS elem
            INNER JOIN tags t ON t.name = LOWER(TRIM(elem::text))
            WHERE TRIM(elem::text) <> ''
            ON CONFLICT DO NOTHING
            """
        )
    )

    op.add_column("payments", sa.Column("merchant_id", sa.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "payments_merchant_id_fkey",
        "payments",
        "merchants",
        ["merchant_id"],
        ["id"],
    )
    conn.execute(
        sa.text(
            """
            UPDATE payments p
            SET merchant_id = m.id
            FROM merchants m
            WHERE m.canonical_name = LOWER(TRIM(COALESCE(NULLIF(TRIM(p.merchant), ''), p.description)))
            """
        )
    )
    op.alter_column("payments", "merchant_id", nullable=False)
    op.drop_table("merchant_tags")
    op.drop_table("merchant_aliases")
    op.drop_column("payments", "tags")
    op.drop_column("payments", "merchant")


def downgrade() -> None:
    raise NotImplementedError("downgrade not supported for 011")
