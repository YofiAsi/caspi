import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import UUID, Date, DateTime, ForeignKey, Integer, Numeric, String, delete
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class ImportBatchModel(Base):
    __tablename__ = "import_batches"

    import_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source: Mapped[str] = mapped_column(String, nullable=False)
    file_name: Mapped[str] = mapped_column(String, nullable=False)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payment_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    payments: Mapped[list["PaymentModel"]] = relationship(back_populates="import_batch", cascade="all, delete-orphan")


class PaymentModel(Base):
    __tablename__ = "payments"

    payment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False)
    import_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("import_batches.import_id"), nullable=False)
    source_identifier: Mapped[str | None] = mapped_column(String, nullable=True)
    merchant: Mapped[str | None] = mapped_column(String, nullable=True)
    share_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    share_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    payment_type: Mapped[str] = mapped_column(String, nullable=False, default="unknown")
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    import_batch: Mapped["ImportBatchModel"] = relationship(back_populates="payments")


class MerchantAliasModel(Base):
    __tablename__ = "merchant_aliases"

    original_merchant: Mapped[str] = mapped_column(String, primary_key=True)
    alias: Mapped[str] = mapped_column(String, nullable=False)


class SharingRuleModel(Base):
    __tablename__ = "sharing_rules"

    rule_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_key: Mapped[str] = mapped_column(String, nullable=False)
    share_type: Mapped[str] = mapped_column(String, nullable=False)
    share_value: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    label: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
