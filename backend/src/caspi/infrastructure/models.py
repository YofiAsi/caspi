import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import UUID, Date, DateTime, ForeignKey, Integer, Numeric, String
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


class TagModel(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)


class MerchantModel(Base):
    __tablename__ = "merchants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    canonical_name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    alias: Mapped[str | None] = mapped_column(String, nullable=True)

    payments: Mapped[list["PaymentModel"]] = relationship(back_populates="merchant")


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
    merchant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("merchants.id"), nullable=False)
    share_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    share_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    payment_type: Mapped[str] = mapped_column(String, nullable=False, default="unknown")
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    import_batch: Mapped["ImportBatchModel"] = relationship(back_populates="payments")
    merchant: Mapped["MerchantModel"] = relationship(back_populates="payments")
    payment_tags: Mapped[list["PaymentTagModel"]] = relationship(
        back_populates="payment", cascade="all, delete-orphan"
    )
    payment_collections: Mapped[list["PaymentCollectionModel"]] = relationship(
        back_populates="payment", cascade="all, delete-orphan"
    )


class PaymentTagModel(Base):
    __tablename__ = "payment_tags"

    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payments.payment_id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )

    payment: Mapped["PaymentModel"] = relationship(back_populates="payment_tags")
    tag: Mapped["TagModel"] = relationship()


class MerchantTagLinkModel(Base):
    __tablename__ = "merchant_tag_links"

    merchant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("merchants.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )

    merchant: Mapped["MerchantModel"] = relationship()
    tag: Mapped["TagModel"] = relationship()


class CollectionModel(Base):
    __tablename__ = "collections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)


class PaymentCollectionModel(Base):
    __tablename__ = "payment_collections"

    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payments.payment_id", ondelete="CASCADE"), primary_key=True
    )
    collection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True
    )

    payment: Mapped["PaymentModel"] = relationship(back_populates="payment_collections")
    collection: Mapped["CollectionModel"] = relationship()
