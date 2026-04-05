from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Table,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ── Association tables ──────────────────────────────────────

expense_tags = Table(
    "expense_tags",
    Base.metadata,
    Column("expense_id", UUID(as_uuid=True), ForeignKey("expenses.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

merchant_tags = Table(
    "merchant_tags",
    Base.metadata,
    Column("merchant_id", UUID(as_uuid=True), ForeignKey("merchants.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


# ── Users ───────────────────────────────────────────────────

class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Scraper Credentials ───────────────────────────────────

class ScraperCredentialModel(Base):
    __tablename__ = "scraper_credentials"
    __table_args__ = (
        Index("uq_creds_user_provider_label", "user_id", "provider", func.lower(Column("label", Text)), unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    provider: Mapped[str] = mapped_column(String(30), nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    encrypted_credentials: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ── Tags ────────────────────────────────────────────────────

class TagModel(Base):
    __tablename__ = "tags"
    __table_args__ = (
        Index("uq_tags_user_name", "user_id", func.lower(Column("name", Text)), unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)


# ── Merchants ───────────────────────────────────────────────

class MerchantModel(Base):
    __tablename__ = "merchants"
    __table_args__ = (
        Index("uq_merchants_user_canonical", "user_id", func.lower(Column("canonical_name", Text)), unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    canonical_name: Mapped[str] = mapped_column(Text, nullable=False)
    alias: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_share: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    default_share_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    tags: Mapped[list[TagModel]] = relationship(secondary=merchant_tags, lazy="selectin")


# ── Collections ─────────────────────────────────────────────

class CollectionModel(Base):
    __tablename__ = "collections"
    __table_args__ = (
        Index("uq_collections_user_name", "user_id", func.lower(Column("name", Text)), unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)


# ── Expenses ────────────────────────────────────────────────

class ExpenseModel(Base):
    __tablename__ = "expenses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    merchant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("merchants.id"), nullable=False)
    full_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="ILS")
    share: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    share_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    personal_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    collection_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("collections.id", ondelete="SET NULL"), nullable=True
    )
    source_identifier: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_type: Mapped[str] = mapped_column(String(20), nullable=False, default="unknown")
    extra: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    merchant: Mapped[MerchantModel] = relationship(lazy="selectin")
    tags: Mapped[list[TagModel]] = relationship(secondary=expense_tags, lazy="selectin")
    collection: Mapped[CollectionModel | None] = relationship(lazy="selectin")
