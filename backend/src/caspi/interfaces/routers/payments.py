from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, not_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.domain.value_objects.enums import PaymentType
from caspi.domain.value_objects.ids import PaymentId
from caspi.domain.value_objects.money import Money
from caspi.domain.value_objects.shared_payment import SharedPayment
from caspi.domain.value_objects.tag import Tag
from caspi.infrastructure.database import get_db
from caspi.infrastructure.models import MerchantAliasModel, MerchantTagModel, PaymentModel
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
    payment_tags: list[str]
    merchant_tags: list[str]
    tags: list[str]
    share_amount: Optional[Decimal]
    share_currency: Optional[str]
    extra: dict


class PatchPaymentBody(BaseModel):
    tags: Optional[list[str]] = None
    payment_tags: Optional[list[str]] = None
    merchant_tags: Optional[list[str]] = None
    payment_type: Optional[str] = None
    share_amount: Optional[Decimal] = None
    share_currency: Optional[str] = None
    merchant_alias: Optional[str] = None


def _merchant_key(merchant: Optional[str], description: str) -> str:
    return merchant or description


async def _load_merchant_tags(db: AsyncSession) -> dict[str, list[str]]:
    result = await db.execute(select(MerchantTagModel))
    return {row.merchant_key: list(row.tags or []) for row in result.scalars().all()}


def _to_response(
    p,
    aliases: dict[str, str] | None = None,
    merchant_tags_map: dict[str, list[str]] | None = None,
) -> PaymentResponse:
    resolved_aliases = aliases or {}
    resolved_merchant_tags = merchant_tags_map or {}
    alias_key = _merchant_key(p.merchant, p.description)
    alias = resolved_aliases.get(alias_key)
    display_name = alias or p.merchant or p.description
    payment_tag_names = [t.name for t in p.tags]
    merchant_tag_list = list(resolved_merchant_tags.get(alias_key, []))
    merged = sorted(set(payment_tag_names) | set(merchant_tag_list))
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
        payment_tags=payment_tag_names,
        merchant_tags=merchant_tag_list,
        tags=merged,
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
    stmt = select(PaymentModel).outerjoin(
        MerchantTagModel,
        MerchantTagModel.merchant_key == func.coalesce(PaymentModel.merchant, PaymentModel.description),
    )
    conditions = []

    if include_tags:
        normalized_include = [t.strip().lower() for t in include_tags if t.strip()]
        for tag in normalized_include:
            conditions.append(
                or_(
                    PaymentModel.tags.contains([tag]),
                    MerchantTagModel.tags.contains([tag]),
                )
            )

    if exclude_tags:
        normalized_exclude = [t.strip().lower() for t in exclude_tags if t.strip()]
        for tag in normalized_exclude:
            conditions.append(
                not_(
                    or_(
                        PaymentModel.tags.contains([tag]),
                        MerchantTagModel.tags.contains([tag]),
                    )
                )
            )

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
    merchant_tags_map = await _load_merchant_tags(db)
    models = await _query_payments(
        db,
        include_tags=include_tags,
        exclude_tags=exclude_tags,
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
    )
    return [_to_response(_to_domain(m), aliases, merchant_tags_map) for m in models]


async def _apply_merchant_tags_patch(db: AsyncSession, merchant_key: str, tags_value: list[str]) -> None:
    normalized = [str(t).strip().lower() for t in tags_value if str(t).strip()]
    row = await db.get(MerchantTagModel, merchant_key)
    if not normalized:
        if row:
            await db.delete(row)
        return
    if row:
        row.tags = normalized
    else:
        db.add(MerchantTagModel(merchant_key=merchant_key, tags=normalized))


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

    update = body.model_dump(exclude_unset=True)
    if "payment_tags" in update:
        payment.tags = [Tag(name=t) for t in update["payment_tags"]]
    elif "tags" in update:
        payment.tags = [Tag(name=t) for t in update["tags"]]

    if body.payment_type is not None:
        try:
            payment.payment_type = PaymentType(body.payment_type)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid payment_type: {body.payment_type}")

    if "share_amount" in update:
        if update["share_amount"] is None:
            payment.shared_payment = None
        else:
            currency = body.share_currency or (
                payment.shared_payment.my_share.currency if payment.shared_payment else payment.amount.currency
            )
            payment.shared_payment = SharedPayment(my_share=Money(body.share_amount, currency))
    elif "share_currency" in update and update["share_currency"] is not None:
        if payment.shared_payment:
            payment.shared_payment = SharedPayment(
                my_share=Money(payment.shared_payment.my_share.amount, body.share_currency)
            )

    if "merchant_alias" in update:
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

    if "merchant_tags" in update:
        mk = _merchant_key(payment.merchant, payment.description)
        await _apply_merchant_tags_patch(db, mk, update["merchant_tags"])

    await repo.save(payment)
    await db.commit()

    aliases = await _load_aliases(db)
    merchant_tags_map = await _load_merchant_tags(db)
    return _to_response(payment, aliases, merchant_tags_map)
