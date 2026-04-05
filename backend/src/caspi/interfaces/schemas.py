import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


# ── Tags ───────────────────────────────────────────────────

class TagCreate(BaseModel):
    name: str

class TagUpdate(BaseModel):
    name: str

class TagOut(BaseModel):
    id: uuid.UUID
    name: str


# ── Merchants ──────────────────────────────────────────────

class MerchantUpdate(BaseModel):
    alias: str | None = None
    default_share: Decimal | None = None
    default_share_amount: Decimal | None = None
    tag_ids: list[uuid.UUID] = Field(default_factory=list)

class MerchantOut(BaseModel):
    id: uuid.UUID
    canonical_name: str
    alias: str | None
    default_share: Decimal | None
    default_share_amount: Decimal | None
    tags: list[TagOut]


# ── Collections ────────────────────────────────────────────

class CollectionCreate(BaseModel):
    name: str
    start_date: date | None = None
    end_date: date | None = None

class CollectionUpdate(BaseModel):
    name: str | None = None
    start_date: date | None = None
    end_date: date | None = None

class CollectionOut(BaseModel):
    id: uuid.UUID
    name: str
    start_date: date | None
    end_date: date | None

class TagTotal(BaseModel):
    tag: str
    total: Decimal

class CollectionStats(BaseModel):
    total_personal: Decimal
    expense_count: int
    by_tag: list[TagTotal]

class CollectionDetailOut(CollectionOut):
    stats: CollectionStats


# ── Expenses ───────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    date: date
    merchant_id: uuid.UUID
    full_amount: Decimal
    currency: str = "ILS"
    share: Decimal | None = None
    share_amount: Decimal | None = None
    tag_ids: list[uuid.UUID] = Field(default_factory=list)
    collection_id: uuid.UUID | None = None
    payment_type: str = "normal"
    extra: dict | None = None

class ExpenseUpdate(BaseModel):
    date: date | None = None
    merchant_id: uuid.UUID | None = None
    full_amount: Decimal | None = None
    currency: str | None = None
    share: Decimal | None = None
    share_amount: Decimal | None = None
    tag_ids: list[uuid.UUID] | None = None
    collection_id: uuid.UUID | None = None
    payment_type: str | None = None
    extra: dict | None = None

class MerchantBrief(BaseModel):
    id: uuid.UUID
    canonical_name: str
    alias: str | None

class CollectionBrief(BaseModel):
    id: uuid.UUID
    name: str

class ExpenseOut(BaseModel):
    id: uuid.UUID
    date: date
    merchant: MerchantBrief
    full_amount: Decimal
    currency: str
    share: Decimal | None
    share_amount: Decimal | None
    personal_amount: Decimal
    tags: list[TagOut]
    merchant_tags: list[TagOut]
    collection: CollectionBrief | None
    payment_type: str
    source_identifier: str | None
    extra: dict | None
    created_at: datetime


# ── Credentials ────────────────────────────────────────────

class CredentialCreate(BaseModel):
    provider: str
    label: str
    credentials: dict

class CredentialUpdate(BaseModel):
    label: str | None = None
    credentials: dict | None = None

class CredentialOut(BaseModel):
    id: uuid.UUID
    provider: str
    label: str
    created_at: datetime
    updated_at: datetime


# ── Scrape ─────────────────────────────────────────────────

class ScrapeRequest(BaseModel):
    start_date: date | None = None
    end_date: date | None = None

class ScrapeResult(BaseModel):
    imported: int
    skipped: int
    errors: list[str]

class ProviderInfo(BaseModel):
    id: str
    name: str
    login_fields: list[str]


# ── Analytics ──────────────────────────────────────────────

class MonthlyBucket(BaseModel):
    month: str
    total_personal: Decimal
    expense_count: int

class TagBucket(BaseModel):
    tag_id: uuid.UUID
    tag_name: str
    total_personal: Decimal
    expense_count: int

class MerchantBucket(BaseModel):
    merchant_id: uuid.UUID
    merchant_name: str
    total_personal: Decimal
    expense_count: int


# ── Pagination ─────────────────────────────────────────────

class PaginatedExpenses(BaseModel):
    items: list[ExpenseOut]
    total: int
    limit: int
    offset: int
