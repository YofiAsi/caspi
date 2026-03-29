from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.payments.aggregate_summary import aggregate_payment_summary
from caspi.application.payments.response_mapper import domain_payment_to_response
from caspi.infrastructure.repositories.merchant_alias_repository import SqlMerchantAliasRepository
from caspi.infrastructure.repositories.merchant_tag_repository import SqlMerchantTagRepository
from caspi.infrastructure.repositories.payment_mapper import payment_model_to_domain
from caspi.infrastructure.repositories.payment_query_repository import SqlPaymentQueryRepository
from caspi.interfaces.schemas.payments import PaymentListCursor, PaymentListPageResponse, PaymentResponse


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
    alias_repo = SqlMerchantAliasRepository(db)
    tag_repo = SqlMerchantTagRepository(db)
    query_repo = SqlPaymentQueryRepository(db)
    aliases = await alias_repo.load_all_map()
    merchant_tags_map = await tag_repo.load_all_map()
    models = await query_repo.fetch_filtered_models(
        include_tags=include_tags,
        exclude_tags=exclude_tags,
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
        tagged_only=tagged_only,
    )
    return [
        domain_payment_to_response(payment_model_to_domain(m), aliases, merchant_tags_map)
        for m in models
    ]


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
    alias_repo = SqlMerchantAliasRepository(db)
    tag_repo = SqlMerchantTagRepository(db)
    query_repo = SqlPaymentQueryRepository(db)
    aliases = await alias_repo.load_all_map()
    merchant_tags_map = await tag_repo.load_all_map()
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
    items = [
        domain_payment_to_response(payment_model_to_domain(m), aliases, merchant_tags_map)
        for m in models
    ]
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
    return aggregate_payment_summary(responses)
