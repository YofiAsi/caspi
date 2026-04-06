from calendar import monthrange
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.payments.aggregate_full_tag_slices import aggregate_full_merged_tag_slices
from caspi.application.payments.aggregate_month_tag_slices import aggregate_month_tag_slices
from caspi.application.payments.aggregate_summary import aggregate_payment_summary
from caspi.application.payments.response_mapper import domain_payment_to_response
from caspi.infrastructure.models import PaymentCollectionModel, PaymentModel, TagModel
from caspi.infrastructure.repositories.merchant_repository import SqlMerchantRepository
from caspi.infrastructure.repositories.payment_mapper import payment_model_to_domain
from caspi.infrastructure.repositories.payment_query_repository import SqlPaymentQueryRepository
from caspi.interfaces.schemas.payments import (
    ListFilterTotals,
    MonthTagSlicesResponse,
    PaymentListCursor,
    PaymentListPageResponse,
    PaymentResponse,
)


async def _tag_name_by_id(db: AsyncSession, ids: set[str]) -> dict[str, str]:
    if not ids:
        return {}
    uuids = []
    for s in ids:
        try:
            uuids.append(UUID(s))
        except ValueError:
            continue
    if not uuids:
        return {}
    result = await db.execute(select(TagModel).where(TagModel.id.in_(uuids)))
    return {str(t.id): t.name for t in result.scalars().all()}


def _merchant_sort_key_response(r: PaymentResponse) -> str:
    return (r.display_name or "").strip().lower()


async def list_payment_responses(
    db: AsyncSession,
    *,
    include_tags: Optional[list[str]] = None,
    exclude_tags: Optional[list[str]] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    amount_min: Optional[Decimal] = None,
    amount_max: Optional[Decimal] = None,
    tagged_only: Optional[bool] = None,
    currency: Optional[str] = None,
    apply_tag_slice: bool = False,
    filter_tag_id: Optional[UUID] = None,
    other_tag_ids: Optional[list[UUID]] = None,
    collection_id: Optional[UUID] = None,
    apply_tag_combo: bool = False,
    merged_tag_ids: Optional[list[UUID]] = None,
    apply_tag_combo_other: bool = False,
    tag_combo_excludes: Optional[list[list[UUID]]] = None,
) -> list[PaymentResponse]:
    merchant_repo = SqlMerchantRepository(db)
    merchant_tag_map = await merchant_repo.load_tag_ids_by_merchant()
    query_repo = SqlPaymentQueryRepository(db)
    models = await query_repo.fetch_filtered_models(
        include_tags=include_tags,
        exclude_tags=exclude_tags,
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
        tagged_only=tagged_only,
        currency=currency,
        apply_tag_slice=apply_tag_slice,
        filter_tag_id=filter_tag_id,
        other_tag_ids=other_tag_ids,
        collection_id=collection_id,
        apply_tag_combo=apply_tag_combo,
        merged_tag_ids=merged_tag_ids,
        apply_tag_combo_other=apply_tag_combo_other,
        tag_combo_excludes=tag_combo_excludes,
    )
    out: list[PaymentResponse] = []
    for m in models:
        p = payment_model_to_domain(m)
        alias = m.merchant.alias if m.merchant is not None else None
        mt = merchant_tag_map.get(m.merchant_id, [])
        out.append(
            domain_payment_to_response(
                p,
                merchant_alias=alias,
                merchant_tag_ids=mt,
            )
        )
    return out


async def list_payments_page(
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
    currency: Optional[str] = None,
    apply_tag_slice: bool = False,
    filter_tag_id: Optional[UUID] = None,
    other_tag_ids: Optional[list[UUID]] = None,
    sort: Optional[str] = None,
    limit: int = 50,
    after_date: Optional[date] = None,
    after_payment_id: Optional[UUID] = None,
    after_effective_amount: Optional[Decimal] = None,
    after_merchant_key: Optional[str] = None,
    include_totals: bool = False,
    collection_id: Optional[UUID] = None,
    apply_tag_combo: bool = False,
    merged_tag_ids: Optional[list[UUID]] = None,
    apply_tag_combo_other: bool = False,
    tag_combo_excludes: Optional[list[list[UUID]]] = None,
) -> PaymentListPageResponse:
    merchant_repo = SqlMerchantRepository(db)
    merchant_tag_map = await merchant_repo.load_tag_ids_by_merchant()
    query_repo = SqlPaymentQueryRepository(db)

    filter_totals: Optional[ListFilterTotals] = None
    if include_totals:
        cnt, ssum = await query_repo.count_and_sum_effective(
            include_tags=include_tags,
            exclude_tags=exclude_tags,
            date_from=date_from,
            date_to=date_to,
            amount_min=amount_min,
            amount_max=amount_max,
            tagged_only=tagged_only,
            search_q=search_q,
            currency=currency,
            apply_tag_slice=apply_tag_slice,
            filter_tag_id=filter_tag_id,
            other_tag_ids=other_tag_ids,
            collection_id=collection_id,
            apply_tag_combo=apply_tag_combo,
            merged_tag_ids=merged_tag_ids,
            apply_tag_combo_other=apply_tag_combo_other,
            tag_combo_excludes=tag_combo_excludes,
        )
        filter_totals = ListFilterTotals(payment_count=cnt, sum_effective=ssum)

    models = await query_repo.fetch_filtered_models(
        include_tags=include_tags,
        exclude_tags=exclude_tags,
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
        tagged_only=tagged_only,
        search_q=search_q,
        currency=currency,
        apply_tag_slice=apply_tag_slice,
        filter_tag_id=filter_tag_id,
        other_tag_ids=other_tag_ids,
        sort=sort,
        limit=limit,
        after_date=after_date,
        after_payment_id=after_payment_id,
        after_effective_amount=after_effective_amount,
        after_merchant_key=after_merchant_key,
        collection_id=collection_id,
        apply_tag_combo=apply_tag_combo,
        merged_tag_ids=merged_tag_ids,
        apply_tag_combo_other=apply_tag_combo_other,
        tag_combo_excludes=tag_combo_excludes,
    )
    items: list[PaymentResponse] = []
    for m in models:
        p = payment_model_to_domain(m)
        alias = m.merchant.alias if m.merchant is not None else None
        mt = merchant_tag_map.get(m.merchant_id, [])
        items.append(
            domain_payment_to_response(
                p,
                merchant_alias=alias,
                merchant_tag_ids=mt,
            )
        )
    next_cursor: Optional[PaymentListCursor] = None
    if len(items) == limit:
        last = items[-1]
        next_cursor = PaymentListCursor(
            date=last.date,
            payment_id=last.payment_id,
            effective_amount=last.effective_amount,
            merchant_sort_key=_merchant_sort_key_response(last),
        )
    return PaymentListPageResponse(items=items, next_cursor=next_cursor, filter_totals=filter_totals)


async def payment_summary_for_filters(
    db: AsyncSession,
    *,
    include_tags: Optional[list[str]] = None,
    exclude_tags: Optional[list[str]] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    amount_min: Optional[Decimal] = None,
    amount_max: Optional[Decimal] = None,
    tagged_only: Optional[bool] = None,
    collection_id: Optional[UUID] = None,
    apply_tag_combo: bool = False,
    merged_tag_ids: Optional[list[UUID]] = None,
    apply_tag_combo_other: bool = False,
    tag_combo_excludes: Optional[list[list[UUID]]] = None,
):
    responses = await list_payment_responses(
        db,
        include_tags=include_tags,
        exclude_tags=exclude_tags,
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
        tagged_only=tagged_only,
        collection_id=collection_id,
        apply_tag_combo=apply_tag_combo,
        merged_tag_ids=merged_tag_ids,
        apply_tag_combo_other=apply_tag_combo_other,
        tag_combo_excludes=tag_combo_excludes,
    )
    ids: set[str] = set()
    for r in responses:
        ids.update(r.payment_tags)
        ids.update(r.merchant_tags)
    tag_name_by_id = await _tag_name_by_id(db, ids)
    return aggregate_payment_summary(responses, tag_name_by_id=tag_name_by_id)


async def month_tag_slices_for_month(
    db: AsyncSession,
    *,
    year: int,
    month: int,
    filter_tag_id: str,
) -> MonthTagSlicesResponse:
    ft = UUID(filter_tag_id)
    last_d = monthrange(year, month)[1]
    date_from = date(year, month, 1)
    date_to = date(year, month, last_d)
    responses = await list_payment_responses(
        db,
        include_tags=[filter_tag_id],
        date_from=date_from,
        date_to=date_to,
        currency="ILS",
    )
    ids: set[str] = {filter_tag_id}
    for r in responses:
        ids.update(r.payment_tags)
        ids.update(r.merchant_tags)
    tag_name_by_id = await _tag_name_by_id(db, ids)
    return aggregate_month_tag_slices(
        responses,
        filter_tag_id=filter_tag_id,
        tag_name_by_id=tag_name_by_id,
        currency="ILS",
    )


async def payment_timeseries(
    db: AsyncSession,
    *,
    granularity: str,
    include_tags: Optional[list[str]] = None,
    exclude_tags: Optional[list[str]] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    amount_min: Optional[Decimal] = None,
    amount_max: Optional[Decimal] = None,
    tagged_only: Optional[bool] = None,
    currency: Optional[str] = None,
    collection_id: Optional[UUID] = None,
    apply_tag_combo: bool = False,
    merged_tag_ids: Optional[list[UUID]] = None,
    apply_tag_combo_other: bool = False,
    tag_combo_excludes: Optional[list[list[UUID]]] = None,
) -> list[tuple[date, Decimal, int]]:
    query_repo = SqlPaymentQueryRepository(db)
    return await query_repo.timeseries(
        granularity=granularity,
        include_tags=include_tags,
        exclude_tags=exclude_tags,
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
        tagged_only=tagged_only,
        currency=currency,
        collection_id=collection_id,
        apply_tag_combo=apply_tag_combo,
        merged_tag_ids=merged_tag_ids,
        apply_tag_combo_other=apply_tag_combo_other,
        tag_combo_excludes=tag_combo_excludes,
    )


async def period_tag_slices(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
    filter_tag_id: str,
) -> MonthTagSlicesResponse:
    responses = await list_payment_responses(
        db,
        include_tags=[filter_tag_id],
        date_from=date_from,
        date_to=date_to,
        currency="ILS",
    )
    ids: set[str] = {filter_tag_id}
    for r in responses:
        ids.update(r.payment_tags)
        ids.update(r.merchant_tags)
    tag_name_by_id = await _tag_name_by_id(db, ids)
    return aggregate_month_tag_slices(
        responses,
        filter_tag_id=filter_tag_id,
        tag_name_by_id=tag_name_by_id,
        currency="ILS",
    )


async def collection_tag_slices(
    db: AsyncSession,
    *,
    collection_id: UUID,
) -> MonthTagSlicesResponse:
    responses = await list_payment_responses(
        db,
        collection_id=collection_id,
        currency="ILS",
    )
    ids: set[str] = set()
    for r in responses:
        ids.update(r.payment_tags)
        ids.update(r.merchant_tags)
    tag_name_by_id = await _tag_name_by_id(db, ids)
    return aggregate_full_merged_tag_slices(
        responses,
        tag_name_by_id=tag_name_by_id,
        currency="ILS",
    )


async def collection_timeseries(
    db: AsyncSession,
    *,
    collection_id: UUID,
    granularity: str,
) -> list[tuple[date, Decimal, int]]:
    trunc = {"daily": "day", "weekly": "week", "monthly": "month"}[granularity]
    eff = func.coalesce(PaymentModel.share_amount, PaymentModel.amount)
    period_col = func.date_trunc(trunc, PaymentModel.date).label("period_start")
    stmt = (
        select(
            period_col,
            func.coalesce(func.sum(eff), 0),
            func.count(PaymentModel.payment_id),
        )
        .select_from(PaymentModel)
        .join(
            PaymentCollectionModel,
            PaymentCollectionModel.payment_id == PaymentModel.payment_id,
        )
        .where(
            PaymentCollectionModel.collection_id == collection_id,
            PaymentModel.currency == "ILS",
        )
        .group_by(period_col)
        .order_by(period_col)
    )
    result = await db.execute(stmt)
    rows: list[tuple[date, Decimal, int]] = []
    for r in result.all():
        p0 = r[0]
        d = p0.date() if hasattr(p0, "date") else p0
        rows.append((d, Decimal(str(r[1])), int(r[2])))
    return rows
