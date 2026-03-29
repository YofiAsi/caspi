from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import String, and_, cast, func, literal, not_, or_, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.infrastructure.models import MerchantAliasModel, MerchantTagModel, PaymentModel


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


class SqlPaymentQueryRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def fetch_filtered_models(
        self,
        *,
        include_tags: Optional[list[str]],
        exclude_tags: Optional[list[str]],
        date_from: Optional[date],
        date_to: Optional[date],
        amount_min: Optional[Decimal],
        amount_max: Optional[Decimal],
        tagged_only: Optional[bool] = None,
        search_q: Optional[str] = None,
        limit: Optional[int] = None,
        after_date: Optional[date] = None,
        after_payment_id: Optional[UUID] = None,
    ) -> list[PaymentModel]:
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

        result = await self._session.execute(stmt)
        return list(result.scalars().all())
