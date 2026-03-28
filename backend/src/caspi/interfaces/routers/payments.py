from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import String, and_, cast, func, literal, not_, or_, select
from sqlalchemy.dialects.postgresql import JSONB
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


class PaymentListCursor(BaseModel):
    date: date
    payment_id: str


class PaymentListPageResponse(BaseModel):
    items: list[PaymentResponse]
    next_cursor: Optional[PaymentListCursor] = None


class PatchPaymentBody(BaseModel):
    tags: Optional[list[str]] = None
    payment_tags: Optional[list[str]] = None
    merchant_tags: Optional[list[str]] = None
    payment_type: Optional[str] = None
    share_amount: Optional[Decimal] = None
    share_currency: Optional[str] = None
    merchant_alias: Optional[str] = None


class CurrencyTotals(BaseModel):
    currency: str
    sum_effective: Decimal
    sum_amount: Decimal


class TagSummaryRow(BaseModel):
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


TOP_MERCHANTS_PER_CURRENCY = 10


def _escape_ilike_pattern(fragment: str) -> str:
    return (
        fragment.replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )


def _search_tokens(search_q: Optional[str]) -> list[str]:
    if not search_q or not str(search_q).strip():
        return []
    return [t for t in str(search_q).split() if t]


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


def _aggregate_payment_summary(responses: list[PaymentResponse]) -> PaymentSummaryResponse:
    if not responses:
        return PaymentSummaryResponse(
            payment_count=0,
            totals_by_currency=[],
            by_tag=[],
            untagged_by_currency=[],
            by_payment_type=[],
            top_merchants=[],
            by_month=[],
        )

    totals_eff: dict[str, Decimal] = defaultdict(lambda: Decimal(0))
    totals_amt: dict[str, Decimal] = defaultdict(lambda: Decimal(0))
    tag_sum: dict[tuple[str, str], Decimal] = defaultdict(lambda: Decimal(0))
    tag_pay_count: dict[tuple[str, str], int] = defaultdict(int)
    untagged_eff: dict[str, Decimal] = defaultdict(lambda: Decimal(0))
    untagged_count: dict[str, int] = defaultdict(int)
    ptype_sum: dict[tuple[str, str], Decimal] = defaultdict(lambda: Decimal(0))
    ptype_count: dict[tuple[str, str], int] = defaultdict(int)
    merchant_sum: dict[tuple[str, str], Decimal] = defaultdict(lambda: Decimal(0))
    merchant_count: dict[tuple[str, str], int] = defaultdict(int)
    month_sum: dict[tuple[int, int, str], Decimal] = defaultdict(lambda: Decimal(0))
    month_count: dict[tuple[int, int, str], int] = defaultdict(int)

    for r in responses:
        c = r.currency
        totals_eff[c] += r.effective_amount
        totals_amt[c] += r.amount

        if r.tags:
            for tag in r.tags:
                k = (tag, c)
                tag_sum[k] += r.effective_amount
                tag_pay_count[k] += 1
        else:
            untagged_eff[c] += r.effective_amount
            untagged_count[c] += 1

        pk = (r.payment_type, c)
        ptype_sum[pk] += r.effective_amount
        ptype_count[pk] += 1

        mk = (r.display_name, c)
        merchant_sum[mk] += r.effective_amount
        merchant_count[mk] += 1

        y, m = r.date.year, r.date.month
        bk = (y, m, c)
        month_sum[bk] += r.effective_amount
        month_count[bk] += 1

    totals_by_currency = [
        CurrencyTotals(currency=cur, sum_effective=totals_eff[cur], sum_amount=totals_amt[cur])
        for cur in sorted(totals_eff.keys())
    ]

    by_tag_rows = sorted(
        (
            TagSummaryRow(
                tag=tag,
                currency=cur,
                sum_effective=tag_sum[(tag, cur)],
                payment_count=tag_pay_count[(tag, cur)],
            )
            for tag, cur in tag_sum.keys()
        ),
        key=lambda row: (-row.sum_effective, row.tag),
    )

    untagged_by_currency = [
        UntaggedByCurrency(
            currency=cur,
            payment_count=untagged_count[cur],
            sum_effective=untagged_eff[cur],
        )
        for cur in sorted(untagged_eff.keys())
        if untagged_count[cur] > 0
    ]

    by_payment_type = sorted(
        (
            PaymentTypeSummaryRow(
                payment_type=pt,
                currency=cur,
                payment_count=ptype_count[(pt, cur)],
                sum_effective=ptype_sum[(pt, cur)],
            )
            for pt, cur in ptype_sum.keys()
        ),
        key=lambda row: (-row.sum_effective, row.payment_type),
    )

    top_merchants: list[MerchantSummaryRow] = []
    merchants_by_currency: dict[str, list[tuple[str, Decimal, int]]] = defaultdict(list)
    for (name, cur), s in merchant_sum.items():
        merchants_by_currency[cur].append((name, s, merchant_count[(name, cur)]))
    for cur in sorted(merchants_by_currency.keys()):
        ranked = sorted(merchants_by_currency[cur], key=lambda t: (-t[1], t[0]))[:TOP_MERCHANTS_PER_CURRENCY]
        for name, s, cnt in ranked:
            top_merchants.append(
                MerchantSummaryRow(display_name=name, currency=cur, payment_count=cnt, sum_effective=s)
            )

    by_month = sorted(
        (
            MonthSummaryRow(
                year=y,
                month=m,
                currency=cur,
                payment_count=month_count[(y, m, cur)],
                sum_effective=month_sum[(y, m, cur)],
            )
            for y, m, cur in month_sum.keys()
        ),
        key=lambda row: (row.year, row.month, row.currency),
    )

    return PaymentSummaryResponse(
        payment_count=len(responses),
        totals_by_currency=totals_by_currency,
        by_tag=by_tag_rows,
        untagged_by_currency=untagged_by_currency,
        by_payment_type=by_payment_type,
        top_merchants=top_merchants,
        by_month=by_month,
    )


async def _query_payments(
    db: AsyncSession,
    include_tags: Optional[list[str]],
    exclude_tags: Optional[list[str]],
    date_from: Optional[date],
    date_to: Optional[date],
    amount_min: Optional[Decimal],
    amount_max: Optional[Decimal],
    tagged_only: Optional[bool] = None,
    *,
    search_q: Optional[str] = None,
    limit: Optional[int] = None,
    after_date: Optional[date] = None,
    after_payment_id: Optional[UUID] = None,
):
    merchant_key_expr = func.coalesce(PaymentModel.merchant, PaymentModel.description)
    stmt = (
        select(PaymentModel)
        .outerjoin(
            MerchantTagModel,
            MerchantTagModel.merchant_key == merchant_key_expr,
        )
        .outerjoin(
            MerchantAliasModel,
            MerchantAliasModel.original_merchant == merchant_key_expr,
        )
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

    if tagged_only:
        empty_jsonb = cast(literal("[]"), JSONB)
        merchant_tags_col = func.coalesce(MerchantTagModel.tags, empty_jsonb)
        conditions.append(
            or_(
                func.jsonb_array_length(PaymentModel.tags) > 0,
                func.jsonb_array_length(merchant_tags_col) > 0,
            )
        )

    tokens = _search_tokens(search_q)
    if tokens:
        empty_jsonb_tags = cast(literal("[]"), JSONB)
        merchant_tags_text = cast(
            func.coalesce(MerchantTagModel.tags, empty_jsonb_tags),
            String,
        )
        payment_tags_text = cast(PaymentModel.tags, String)
        for token in tokens:
            pat = f"%{_escape_ilike_pattern(token)}%"
            conditions.append(
                or_(
                    PaymentModel.description.ilike(pat, escape="\\"),
                    func.coalesce(PaymentModel.merchant, "").ilike(pat, escape="\\"),
                    MerchantAliasModel.alias.ilike(pat, escape="\\"),
                    payment_tags_text.ilike(pat, escape="\\"),
                    merchant_tags_text.ilike(pat, escape="\\"),
                )
            )

    if conditions:
        stmt = stmt.where(and_(*conditions))

    if after_date is not None and after_payment_id is not None:
        stmt = stmt.where(
            or_(
                PaymentModel.date < after_date,
                and_(PaymentModel.date == after_date, PaymentModel.payment_id < after_payment_id),
            )
        )

    stmt = stmt.order_by(PaymentModel.date.desc(), PaymentModel.payment_id.desc())
    if limit is not None:
        stmt = stmt.limit(limit)

    result = await db.execute(stmt)
    return result.scalars().all()


async def _list_payment_responses(
    db: AsyncSession,
    *,
    include_tags: Optional[list[str]] = None,
    exclude_tags: Optional[list[str]] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    amount_min: Optional[Decimal] = None,
    amount_max: Optional[Decimal] = None,
    tagged_only: Optional[bool] = None,
) -> list[PaymentResponse]:
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
        tagged_only=tagged_only,
    )
    return [_to_response(_to_domain(m), aliases, merchant_tags_map) for m in models]


async def _list_payments_page(
    db: AsyncSession,
    *,
    include_tags: Optional[list[str]] = None,
    exclude_tags: Optional[list[str]] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    amount_min: Optional[Decimal] = None,
    amount_max: Optional[Decimal] = None,
    tagged_only: Optional[bool] = None,
    search_q: Optional[str] = None,
    limit: int = 50,
    after_date: Optional[date] = None,
    after_payment_id: Optional[UUID] = None,
) -> PaymentListPageResponse:
    from caspi.infrastructure.repositories.payment_repository import _to_domain

    aliases = await _load_aliases(db)
    merchant_tags_map = await _load_merchant_tags(db)
    models = await _query_payments(
        db,
        include_tags,
        exclude_tags,
        date_from,
        date_to,
        amount_min,
        amount_max,
        tagged_only,
        search_q=search_q,
        limit=limit,
        after_date=after_date,
        after_payment_id=after_payment_id,
    )
    items = [_to_response(_to_domain(m), aliases, merchant_tags_map) for m in models]
    next_cursor: Optional[PaymentListCursor] = None
    if len(items) == limit:
        last = items[-1]
        next_cursor = PaymentListCursor(date=last.date, payment_id=last.payment_id)
    return PaymentListPageResponse(items=items, next_cursor=next_cursor)


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
    responses = await _list_payment_responses(
        db,
        include_tags=include_tags,
        exclude_tags=exclude_tags,
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
        tagged_only=tagged_only or None,
    )
    return _aggregate_payment_summary(responses)


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
    return await _list_payments_page(
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
