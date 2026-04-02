from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

TOP_MERCHANTS_PER_CURRENCY = 10


class PaymentResponse(BaseModel):
    payment_id: str
    merchant_id: str
    date: date
    description: str
    amount: Decimal
    currency: str
    effective_amount: Decimal
    display_name: str
    merchant_alias: Optional[str]
    payment_type: str
    payment_tags: list[str]
    merchant_tags: list[str]
    collection_ids: list[str]
    share_amount: Optional[Decimal]
    share_currency: Optional[str]
    extra: dict


class PaymentListCursor(BaseModel):
    date: date
    payment_id: str
    effective_amount: Optional[Decimal] = None
    merchant_sort_key: Optional[str] = None


class ListFilterTotals(BaseModel):
    payment_count: int
    sum_effective: Decimal


class PaymentListPageResponse(BaseModel):
    items: list[PaymentResponse]
    next_cursor: Optional[PaymentListCursor] = None
    filter_totals: Optional[ListFilterTotals] = None


class MonthTagSliceRow(BaseModel):
    other_tag_ids: list[str]
    label: str
    sum_effective: Decimal
    payment_count: int
    fraction: Decimal
    is_other: bool = False


class MonthTagSlicesResponse(BaseModel):
    currency: str
    month_total_effective: Decimal
    payment_count: int
    slices: list[MonthTagSliceRow]


class PatchPaymentBody(BaseModel):
    payment_tags: Optional[list[str]] = None
    merchant_tags: Optional[list[str]] = None
    collection_ids: Optional[list[str]] = None
    payment_type: Optional[str] = None
    share_amount: Optional[Decimal] = None
    share_currency: Optional[str] = None
    merchant_alias: Optional[str] = None


class CurrencyTotals(BaseModel):
    currency: str
    sum_effective: Decimal
    sum_amount: Decimal


class TagSummaryRow(BaseModel):
    tag_id: str
    tag: str
    currency: str
    sum_effective: Decimal
    payment_count: int


class UntaggedByCurrency(BaseModel):
    currency: str
    payment_count: int
    sum_effective: Decimal


class PaymentTypeSummaryRow(BaseModel):
    payment_type: str
    currency: str
    payment_count: int
    sum_effective: Decimal


class MerchantSummaryRow(BaseModel):
    display_name: str
    currency: str
    payment_count: int
    sum_effective: Decimal


class MonthSummaryRow(BaseModel):
    year: int
    month: int
    currency: str
    payment_count: int
    sum_effective: Decimal


class PaymentSummaryResponse(BaseModel):
    payment_count: int
    totals_by_currency: list[CurrencyTotals]
    by_tag: list[TagSummaryRow]
    untagged_by_currency: list[UntaggedByCurrency]
    by_payment_type: list[PaymentTypeSummaryRow]
    top_merchants: list[MerchantSummaryRow]
    by_month: list[MonthSummaryRow]
