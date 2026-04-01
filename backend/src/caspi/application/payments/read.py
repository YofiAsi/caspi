from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.payments.aggregate_summary import aggregate_payment_summary
from caspi.application.payments.response_mapper import domain_payment_to_response
from caspi.infrastructure.models import TagModel
from caspi.infrastructure.repositories.merchant_repository import SqlMerchantRepository
from caspi.infrastructure.repositories.payment_mapper import payment_model_to_domain
from caspi.infrastructure.repositories.payment_query_repository import SqlPaymentQueryRepository
from caspi.interfaces.schemas.payments import PaymentListCursor, PaymentListPageResponse, PaymentResponse


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
    limit: int = 50,
    after_date: Optional[date] = None,
    after_payment_id: Optional[UUID] = None,
) -> PaymentListPageResponse:
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
        search_q=search_q,
        limit=limit,
        after_date=after_date,
        after_payment_id=after_payment_id,
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
        next_cursor = PaymentListCursor(date=last.date, payment_id=last.payment_id)
    return PaymentListPageResponse(items=items, next_cursor=next_cursor)


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
    )
    ids: set[str] = set()
    for r in responses:
        ids.update(r.payment_tags)
        ids.update(r.merchant_tags)
    tag_name_by_id = await _tag_name_by_id(db, ids)
    return aggregate_payment_summary(responses, tag_name_by_id=tag_name_by_id)
