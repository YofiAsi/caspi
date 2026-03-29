from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.payments.read import list_payments_page, payment_summary_for_filters
from caspi.application.payments.update import PaymentPatchValidationError, patch_payment_by_id
from caspi.domain.value_objects.ids import PaymentId
from caspi.infrastructure.database import get_db
from caspi.interfaces.schemas.payments import (
    PatchPaymentBody,
    PaymentListPageResponse,
    PaymentResponse,
    PaymentSummaryResponse,
)

router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.get("/summary", response_model=PaymentSummaryResponse)
async def payments_summary(
    include_tags: Optional[list[str]] = Query(default=None),
    exclude_tags: Optional[list[str]] = Query(default=None),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    amount_min: Optional[Decimal] = None,
    amount_max: Optional[Decimal] = None,
    tagged_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    return await payment_summary_for_filters(
        db,
        include_tags=include_tags,
        exclude_tags=exclude_tags,
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
        tagged_only=tagged_only or None,
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
    limit: int = Query(default=50, ge=1, le=200),
    after_date: Optional[date] = None,
    after_payment_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    if (after_date is None) != (after_payment_id is None):
        raise HTTPException(
            status_code=422,
            detail="after_date and after_payment_id must be supplied together",
        )
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
        limit=limit,
        after_date=after_date,
        after_payment_id=after_payment_id,
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
