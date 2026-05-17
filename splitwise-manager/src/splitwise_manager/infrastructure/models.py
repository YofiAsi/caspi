import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    Integer,
    String,
    Text,
    UUID,
    UniqueConstraint,
    func,
    LargeBinary,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

SCHEMA = "splitwise"


class Base(DeclarativeBase):
    pass


class CredentialsModel(Base):
    __tablename__ = "credentials"
    __table_args__ = (
        UniqueConstraint("singleton_key", name="uq_credentials_singleton"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    singleton_key: Mapped[str] = mapped_column(String, nullable=False, default="default")
    consumer_key_enc: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    consumer_secret_enc: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    api_key_enc: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    splitwise_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_validated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class MerchantShareRuleModel(Base):
    __tablename__ = "merchant_share_rules"
    __table_args__ = (
        UniqueConstraint("merchant_id", name="uq_merchant_share_rule_merchant"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    enabled: Mapped[bool] = mapped_column(nullable=False, default=True)
    splitwise_group_id: Mapped[int] = mapped_column(Integer, nullable=False)
    split_method: Mapped[str] = mapped_column(String, nullable=False)
    split_params: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="ILS")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class SplitwiseLinkModel(Base):
    __tablename__ = "payment_splitwise_links"
    __table_args__ = ({"schema": SCHEMA},)

    payment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    splitwise_expense_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    splitwise_group_id: Mapped[int] = mapped_column(Integer, nullable=False)
    pushed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")


class OutboxModel(Base):
    __tablename__ = "outbox"
    __table_args__ = ({"schema": SCHEMA},)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    operation: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_attempt_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="queued", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
