from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.infrastructure.database import get_db
from caspi.infrastructure.models import (
    ExpenseModel,
    MerchantModel,
    TagModel,
    expense_tags,
    merchant_tags,
)
from caspi.interfaces.dependencies import get_user_id
from caspi.interfaces.schemas import (
    CollectionBrief,
    ExpenseCreate,
    ExpenseOut,
    ExpenseUpdate,
    MerchantBrief,
    PaginatedExpenses,
    TagOut,
)

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


def _expense_out(e: ExpenseModel) -> ExpenseOut:
    return ExpenseOut(
        id=e.id,
        date=e.date,
        merchant=MerchantBrief(id=e.merchant.id, canonical_name=e.merchant.canonical_name, alias=e.merchant.alias),
        full_amount=e.full_amount,
        currency=e.currency,
        share=e.share,
        share_amount=e.share_amount,
        personal_amount=e.personal_amount,
        tags=[TagOut(id=t.id, name=t.name) for t in e.tags],
        merchant_tags=[TagOut(id=t.id, name=t.name) for t in e.merchant.tags],
        collection=CollectionBrief(id=e.collection.id, name=e.collection.name) if e.collection else None,
        payment_type=e.payment_type,
        source_identifier=e.source_identifier,
        extra=e.extra,
        created_at=e.created_at,
    )


def _compute_personal_amount(
    full_amount: Decimal,
    share: Decimal | None,
    share_amount: Decimal | None,
    merchant: MerchantModel | None = None,
) -> tuple[Decimal | None, Decimal | None, Decimal]:
    """Returns (share, share_amount, personal_amount)."""
    if share_amount is not None:
        return share, share_amount, full_amount - share_amount
    if share is not None:
        return share, None, (full_amount * share).quantize(Decimal("0.01"))
    # Fall back to merchant defaults
    if merchant:
        if merchant.default_share_amount is not None:
            return None, merchant.default_share_amount, full_amount - Decimal(str(merchant.default_share_amount))
        if merchant.default_share is not None:
            s = Decimal(str(merchant.default_share))
            return s, None, (full_amount * s).quantize(Decimal("0.01"))
    # No share — 100%
    return Decimal("1"), None, full_amount


SORT_MAP = {
    "date": ExpenseModel.date.asc(),
    "-date": ExpenseModel.date.desc(),
    "amount": ExpenseModel.personal_amount.asc(),
    "-amount": ExpenseModel.personal_amount.desc(),
}


@router.get("", response_model=PaginatedExpenses)
async def list_expenses(
    start_date: date | None = None,
    end_date: date | None = None,
    merchant_id: uuid.UUID | None = None,
    tag_id: uuid.UUID | None = None,
    collection_id: str | None = None,
    payment_type: str | None = None,
    untagged: bool = False,
    sort: str = "-date",
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    user_id: uuid.UUID = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    base = select(ExpenseModel).where(ExpenseModel.user_id == user_id)

    if start_date:
        base = base.where(ExpenseModel.date >= start_date)
    if end_date:
        base = base.where(ExpenseModel.date <= end_date)
    if merchant_id:
        base = base.where(ExpenseModel.merchant_id == merchant_id)
    if payment_type:
        base = base.where(ExpenseModel.payment_type == payment_type)
    if collection_id == "none":
        base = base.where(ExpenseModel.collection_id.is_(None))
    elif collection_id:
        base = base.where(ExpenseModel.collection_id == uuid.UUID(collection_id))
    if untagged:
        # Expenses with no direct tags AND whose merchant has no tags
        base = base.where(
            ~ExpenseModel.id.in_(select(expense_tags.c.expense_id))
            & ~ExpenseModel.merchant_id.in_(select(merchant_tags.c.merchant_id))
        )
    if tag_id:
        # Match expense tags OR merchant tags
        base = base.where(
            ExpenseModel.id.in_(
                select(expense_tags.c.expense_id).where(expense_tags.c.tag_id == tag_id)
            )
            | ExpenseModel.merchant_id.in_(
                select(merchant_tags.c.merchant_id).where(merchant_tags.c.tag_id == tag_id)
            )
        )

    # Count
    count_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_result.scalar_one()

    # Fetch
    order = SORT_MAP.get(sort, ExpenseModel.date.desc())
    result = await db.execute(base.order_by(order).limit(limit).offset(offset))
    items = [_expense_out(e) for e in result.scalars()]

    return PaginatedExpenses(items=items, total=total, limit=limit, offset=offset)


@router.get("/{expense_id}", response_model=ExpenseOut)
async def get_expense(
    expense_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExpenseModel).where(ExpenseModel.id == expense_id, ExpenseModel.user_id == user_id)
    )
    e = result.scalar_one_or_none()
    if not e:
        raise HTTPException(404)
    return _expense_out(e)


@router.post("", response_model=ExpenseOut, status_code=201)
async def create_expense(
    body: ExpenseCreate,
    user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db),
):
    # Validate merchant belongs to user
    mr = await db.execute(
        select(MerchantModel).where(MerchantModel.id == body.merchant_id, MerchantModel.user_id == user_id)
    )
    merchant = mr.scalar_one_or_none()
    if not merchant:
        raise HTTPException(400, "Merchant not found")

    share, share_amount, personal_amount = _compute_personal_amount(
        body.full_amount, body.share, body.share_amount, merchant,
    )

    expense = ExpenseModel(
        id=uuid.uuid4(),
        user_id=user_id,
        date=body.date,
        merchant_id=body.merchant_id,
        full_amount=body.full_amount,
        currency=body.currency,
        share=share,
        share_amount=share_amount,
        personal_amount=personal_amount,
        collection_id=body.collection_id,
        payment_type=body.payment_type,
        extra=body.extra,
    )
    db.add(expense)

    # Tags
    if body.tag_ids:
        tag_result = await db.execute(
            select(TagModel).where(TagModel.id.in_(body.tag_ids), TagModel.user_id == user_id)
        )
        expense.tags = list(tag_result.scalars())

    await db.commit()
    await db.refresh(expense)
    return _expense_out(expense)


@router.put("/{expense_id}", response_model=ExpenseOut)
async def update_expense(
    expense_id: uuid.UUID, body: ExpenseUpdate,
    user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExpenseModel).where(ExpenseModel.id == expense_id, ExpenseModel.user_id == user_id)
    )
    e = result.scalar_one_or_none()
    if not e:
        raise HTTPException(404)

    if body.date is not None:
        e.date = body.date
    if body.merchant_id is not None:
        e.merchant_id = body.merchant_id
    if body.currency is not None:
        e.currency = body.currency
    if body.collection_id is not None:
        e.collection_id = body.collection_id
    if body.payment_type is not None:
        e.payment_type = body.payment_type
    if body.extra is not None:
        e.extra = body.extra

    # Recompute personal_amount if amount/share fields changed
    full = body.full_amount if body.full_amount is not None else Decimal(str(e.full_amount))
    share_val = body.share if body.share is not None else e.share
    share_amt = body.share_amount if body.share_amount is not None else e.share_amount

    if body.full_amount is not None:
        e.full_amount = body.full_amount

    share_out, share_amt_out, personal = _compute_personal_amount(
        full,
        Decimal(str(share_val)) if share_val is not None else None,
        Decimal(str(share_amt)) if share_amt is not None else None,
    )
    e.share = share_out
    e.share_amount = share_amt_out
    e.personal_amount = personal

    if body.tag_ids is not None:
        tag_result = await db.execute(
            select(TagModel).where(TagModel.id.in_(body.tag_ids), TagModel.user_id == user_id)
        )
        e.tags = list(tag_result.scalars())

    await db.commit()
    await db.refresh(e)
    return _expense_out(e)


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExpenseModel).where(ExpenseModel.id == expense_id, ExpenseModel.user_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404)
    await db.execute(delete(ExpenseModel).where(ExpenseModel.id == expense_id))
    await db.commit()
