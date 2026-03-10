from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, not_, select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.domain.value_objects.enums import PaymentType
from caspi.domain.value_objects.ids import PaymentId
from caspi.domain.value_objects.money import Money
from caspi.domain.value_objects.shared_payment import SharedPayment
from caspi.domain.value_objects.tag import Tag
from caspi.infrastructure.database import get_db
from caspi.infrastructure.models import MerchantAliasModel, PaymentModel
from caspi.infrastructure.repositories import SqlPaymentRepository

router = APIRouter(prefix="/api/payments", tags=["payments"])


class PaymentResponse(BaseModel):
    payment_id: str
    date: date
    description: str
    amount: Decimal
    currency: str
    effective_amount: Decimal
    merchant: Optional[str]
    display_name: str
    merchant_alias: Optional[str]
    payment_type: str
    tags: list[str]
    share_amount: Optional[Decimal]
    share_currency: Optional[str]
    extra: dict


class PatchPaymentBody(BaseModel):
    tags: Optional[list[str]] = None
    payment_type: Optional[str] = None
    share_amount: Optional[Decimal] = None
    share_currency: Optional[str] = None
    merchant_alias: Optional[str] = None


def _to_response(p, aliases: dict[str, str] | None = None) -> PaymentResponse:
    resolved_aliases = aliases or {}
    alias_key = p.merchant or p.description
    alias = resolved_aliases.get(alias_key)
    display_name = alias or p.merchant or p.description
    return PaymentResponse(
        payment_id=str(p.payment_id.value),
        date=p.date,
        description=p.description,
        amount=p.amount.amount,
        currency=p.amount.currency,
        effective_amount=p.effective_amount.amount,
        merchant=p.merchant,
        display_name=display_name,
        merchant_alias=alias,
        payment_type=p.payment_type.value,
        tags=[t.name for t in p.tags],
        share_amount=p.shared_payment.my_share.amount if p.shared_payment else None,
        share_currency=p.shared_payment.my_share.currency if p.shared_payment else None,
        extra=p.extra,
    )


async def _load_aliases(db: AsyncSession) -> dict[str, str]:
    result = await db.execute(select(MerchantAliasModel))
    return {row.original_merchant: row.alias for row in result.scalars().all()}


async def _query_payments(
    db: AsyncSession,
    include_tags: Optional[list[str]],
    exclude_tags: Optional[list[str]],
    date_from: Optional[date],
    date_to: Optional[date],
    amount_min: Optional[Decimal],
    amount_max: Optional[Decimal],
):
    stmt = select(PaymentModel)
    conditions = []

    if include_tags:
        normalized_include = [t.strip().lower() for t in include_tags if t.strip()]
        for tag in normalized_include:
            conditions.append(PaymentModel.tags.contains([tag]))

    if exclude_tags:
        normalized_exclude = [t.strip().lower() for t in exclude_tags if t.strip()]
        for tag in normalized_exclude:
            conditions.append(not_(PaymentModel.tags.contains([tag])))

    if date_from is not None:
        conditions.append(PaymentModel.date >= date_from)
    if date_to is not None:
        conditions.append(PaymentModel.date <= date_to)

    if amount_min is not None:
        conditions.append(PaymentModel.amount >= amount_min)
    if amount_max is not None:
        conditions.append(PaymentModel.amount <= amount_max)

    if conditions:
        stmt = stmt.where(and_(*conditions))

    result = await db.execute(stmt.order_by(PaymentModel.date.desc(), PaymentModel.payment_id))
    return result.scalars().all()


@router.get("", response_model=list[PaymentResponse])
async def list_payments(
    include_tags: Optional[list[str]] = Query(default=None),
    exclude_tags: Optional[list[str]] = Query(default=None),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    amount_min: Optional[Decimal] = None,
    amount_max: Optional[Decimal] = None,
    db: AsyncSession = Depends(get_db),
):
    from caspi.infrastructure.repositories.payment_repository import _to_domain
    aliases = await _load_aliases(db)
    models = await _query_payments(
        db,
        include_tags=include_tags,
        exclude_tags=exclude_tags,
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
    )
    return [_to_response(_to_domain(m), aliases) for m in models]


@router.patch("/{payment_id}", response_model=PaymentResponse)
async def patch_payment(payment_id: str, body: PatchPaymentBody, db: AsyncSession = Depends(get_db)):
    try:
        pid = PaymentId(UUID(payment_id))
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid payment_id format")

    repo = SqlPaymentRepository(db)
    payment = await repo.find_by_id(pid)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if body.tags is not None:
        payment.tags = [Tag(name=t) for t in body.tags]

    if body.payment_type is not None:
        try:
            payment.payment_type = PaymentType(body.payment_type)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid payment_type: {body.payment_type}")

    if "share_amount" in body.model_fields_set:
        if body.share_amount is None:
            payment.shared_payment = None
        else:
            currency = body.share_currency or (
                payment.shared_payment.my_share.currency if payment.shared_payment else payment.amount.currency
            )
            payment.shared_payment = SharedPayment(my_share=Money(body.share_amount, currency))
    elif "share_currency" in body.model_fields_set and body.share_currency is not None:
        if payment.shared_payment:
            payment.shared_payment = SharedPayment(
                my_share=Money(payment.shared_payment.my_share.amount, body.share_currency)
            )

    if "merchant_alias" in body.model_fields_set:
        alias_key = payment.merchant or payment.description
        alias_model = await db.get(MerchantAliasModel, alias_key)
        if body.merchant_alias:
            if alias_model:
                alias_model.alias = body.merchant_alias
            else:
                db.add(MerchantAliasModel(original_merchant=alias_key, alias=body.merchant_alias))
        else:
            if alias_model:
                await db.delete(alias_model)

    await repo.save(payment)
    await db.commit()

    aliases = await _load_aliases(db)
    return _to_response(payment, aliases)
