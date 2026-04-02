from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.payments.read import (
    list_payments_page,
    month_tag_slices_for_month,
    payment_summary_for_filters,
)
from caspi.application.payments.update import PaymentPatchValidationError, patch_payment_by_id
from caspi.domain.value_objects.ids import PaymentId
from caspi.infrastructure.database import get_db
from caspi.interfaces.schemas.payments import (
    MonthTagSlicesResponse,
    PatchPaymentBody,
    PaymentListPageResponse,
    PaymentResponse,
    PaymentSummaryResponse,
)

router = APIRouter(prefix="/api/payments", tags=["payments"])


def _parse_uuid_list(raw: Optional[list[str]]) -> Optional[list[UUID]]:
    if not raw:
        return None
    out: list[UUID] = []
    for s in raw:
        try:
            out.append(UUID(str(s)))
        except ValueError:
            continue
    return out


def _parse_collection_id_param(collection_id: Optional[str]) -> Optional[UUID]:
    if collection_id is None:
        return None
    try:
        return UUID(collection_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid collection_id") from None


def _parse_tag_combo_excludes(raw: Optional[list[str]]) -> list[list[UUID]]:
    if not raw:
        return []
    out: list[list[UUID]] = []
    for item in raw:
        parts = [p.strip() for p in item.split(",") if p.strip()]
        row: list[UUID] = []
        for p in parts:
            try:
                row.append(UUID(p))
            except ValueError:
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid tag id in tag_combo_exclude: {p}",
                ) from None
        out.append(row)
    return out


@router.get("/summary", response_model=PaymentSummaryResponse)
async def payments_summary(
    include_tags: Optional[list[str]] = Query(default=None),
    exclude_tags: Optional[list[str]] = Query(default=None),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    amount_min: Optional[Decimal] = None,
    amount_max: Optional[Decimal] = None,
    tagged_only: bool = False,
    collection_id: Optional[str] = Query(default=None),
    apply_tag_combo: bool = False,
    merged_tag_ids: Optional[list[str]] = Query(default=None),
    apply_tag_combo_other: bool = False,
    tag_combo_exclude: Optional[list[str]] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if apply_tag_combo and apply_tag_combo_other:
        raise HTTPException(
            status_code=422,
            detail="apply_tag_combo and apply_tag_combo_other cannot both be true",
        )
    if apply_tag_combo_other:
        excludes = _parse_tag_combo_excludes(tag_combo_exclude)
        if not excludes:
            raise HTTPException(
                status_code=422,
                detail="tag_combo_exclude is required when apply_tag_combo_other is true",
            )
    else:
        excludes = _parse_tag_combo_excludes(tag_combo_exclude)

    combo_ids = _parse_uuid_list(merged_tag_ids) if merged_tag_ids else []
    if combo_ids is None:
        combo_ids = []

    return await payment_summary_for_filters(
        db,
        include_tags=include_tags,
        exclude_tags=exclude_tags,
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
        tagged_only=tagged_only or None,
        collection_id=_parse_collection_id_param(collection_id),
        apply_tag_combo=apply_tag_combo,
        merged_tag_ids=combo_ids if apply_tag_combo else None,
        apply_tag_combo_other=apply_tag_combo_other,
        tag_combo_excludes=excludes if apply_tag_combo_other else None,
    )


@router.get("/analysis/month-tag-slices", response_model=MonthTagSlicesResponse)
async def payments_month_tag_slices(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    filter_tag_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    try:
        UUID(filter_tag_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid filter_tag_id")
    return await month_tag_slices_for_month(
        db,
        year=year,
        month=month,
        filter_tag_id=filter_tag_id,
    )


@router.get("", response_model=PaymentListPageResponse)
async def list_payments(
    include_tags: Optional[list[str]] = Query(default=None),
    exclude_tags: Optional[list[str]] = Query(default=None),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    amount_min: Optional[Decimal] = None,
    amount_max: Optional[Decimal] = None,
    tagged_only: bool = False,
    q: Optional[str] = Query(default=None),
    currency: Optional[str] = Query(default=None, min_length=3, max_length=3),
    sort: Optional[str] = Query(default=None),
    apply_tag_slice: bool = False,
    filter_tag_id: Optional[str] = Query(default=None),
    other_tag_ids: Optional[list[str]] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    after_date: Optional[date] = None,
    after_payment_id: Optional[UUID] = None,
    after_effective_amount: Optional[Decimal] = None,
    after_merchant_key: Optional[str] = None,
    include_totals: bool = False,
    collection_id: Optional[str] = Query(default=None),
    apply_tag_combo: bool = False,
    merged_tag_ids: Optional[list[str]] = Query(default=None),
    apply_tag_combo_other: bool = False,
    tag_combo_exclude: Optional[list[str]] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if (after_date is None) != (after_payment_id is None):
        raise HTTPException(
            status_code=422,
            detail="after_date and after_payment_id must be supplied together",
        )

    if apply_tag_combo and apply_tag_combo_other:
        raise HTTPException(
            status_code=422,
            detail="apply_tag_combo and apply_tag_combo_other cannot both be true",
        )
    if apply_tag_combo_other:
        excludes = _parse_tag_combo_excludes(tag_combo_exclude)
        if not excludes:
            raise HTTPException(
                status_code=422,
                detail="tag_combo_exclude is required when apply_tag_combo_other is true",
            )
    else:
        excludes = _parse_tag_combo_excludes(tag_combo_exclude)

    ft_uuid: Optional[UUID] = None
    if filter_tag_id is not None:
        try:
            ft_uuid = UUID(filter_tag_id)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid filter_tag_id")

    if apply_tag_slice:
        if ft_uuid is None:
            raise HTTPException(
                status_code=422,
                detail="filter_tag_id is required when apply_tag_slice is true",
            )

    slice_other: Optional[list[UUID]] = None
    if apply_tag_slice:
        slice_other = _parse_uuid_list(other_tag_ids)
        if slice_other is None:
            slice_other = []

    combo_ids = _parse_uuid_list(merged_tag_ids) if merged_tag_ids else []
    if combo_ids is None:
        combo_ids = []

    return await list_payments_page(
        db,
        include_tags=include_tags,
        exclude_tags=exclude_tags,
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
        tagged_only=tagged_only or None,
        search_q=q,
        currency=currency.upper().strip() if currency else None,
        apply_tag_slice=apply_tag_slice,
        filter_tag_id=ft_uuid if apply_tag_slice else None,
        other_tag_ids=slice_other,
        sort=sort,
        limit=limit,
        after_date=after_date,
        after_payment_id=after_payment_id,
        after_effective_amount=after_effective_amount,
        after_merchant_key=after_merchant_key,
        include_totals=include_totals,
        collection_id=_parse_collection_id_param(collection_id),
        apply_tag_combo=apply_tag_combo,
        merged_tag_ids=combo_ids if apply_tag_combo else None,
        apply_tag_combo_other=apply_tag_combo_other,
        tag_combo_excludes=excludes if apply_tag_combo_other else None,
    )


@router.patch("/{payment_id}", response_model=PaymentResponse)
async def patch_payment(payment_id: str, body: PatchPaymentBody, db: AsyncSession = Depends(get_db)):
    try:
        pid = PaymentId(UUID(payment_id))
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid payment_id format")

    try:
        result = await patch_payment_by_id(db, pid, body)
    except PaymentPatchValidationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    if not result:
        raise HTTPException(status_code=404, detail="Payment not found")

    return result
