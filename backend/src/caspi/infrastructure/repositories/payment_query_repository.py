from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, exists, func, not_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from caspi.infrastructure.models import (
    MerchantModel,
    MerchantTagLinkModel,
    PaymentModel,
    PaymentTagModel,
    TagModel,
)


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


def _parse_tag_uuids(raw: Optional[list[str]]) -> list[UUID]:
    if not raw:
        return []
    out: list[UUID] = []
    for s in raw:
        try:
            out.append(UUID(str(s)))
        except ValueError:
            continue
    return out


class SqlPaymentQueryRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    def _load_opts(self):
        return (
            joinedload(PaymentModel.merchant),
            selectinload(PaymentModel.payment_tags),
            selectinload(PaymentModel.payment_collections),
        )

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
        stmt = select(PaymentModel).outerjoin(MerchantModel, MerchantModel.id == PaymentModel.merchant_id)
        conditions = []

        include_ids = _parse_tag_uuids(include_tags)
        for tid in include_ids:
            pt = exists(
                select(1).where(
                    PaymentTagModel.payment_id == PaymentModel.payment_id,
                    PaymentTagModel.tag_id == tid,
                )
            )
            mt = exists(
                select(1).where(
                    MerchantTagLinkModel.merchant_id == PaymentModel.merchant_id,
                    MerchantTagLinkModel.tag_id == tid,
                )
            )
            conditions.append(or_(pt, mt))

        exclude_ids = _parse_tag_uuids(exclude_tags)
        for tid in exclude_ids:
            pt = exists(
                select(1).where(
                    PaymentTagModel.payment_id == PaymentModel.payment_id,
                    PaymentTagModel.tag_id == tid,
                )
            )
            mt = exists(
                select(1).where(
                    MerchantTagLinkModel.merchant_id == PaymentModel.merchant_id,
                    MerchantTagLinkModel.tag_id == tid,
                )
            )
            conditions.append(not_(or_(pt, mt)))

        if date_from is not None:
            conditions.append(PaymentModel.date >= date_from)
        if date_to is not None:
            conditions.append(PaymentModel.date <= date_to)

        if amount_min is not None:
            conditions.append(PaymentModel.amount >= amount_min)
        if amount_max is not None:
            conditions.append(PaymentModel.amount <= amount_max)

        if tagged_only:
            pt_any = exists(select(1).where(PaymentTagModel.payment_id == PaymentModel.payment_id))
            mt_any = exists(
                select(1).where(MerchantTagLinkModel.merchant_id == PaymentModel.merchant_id)
            )
            conditions.append(or_(pt_any, mt_any))

        tokens = _search_tokens(search_q)
        for token in tokens:
            pat = f"%{_escape_ilike_pattern(token)}%"
            conditions.append(
                or_(
                    PaymentModel.description.ilike(pat, escape="\\"),
                    MerchantModel.canonical_name.ilike(pat, escape="\\"),
                    func.coalesce(MerchantModel.alias, "").ilike(pat, escape="\\"),
                    exists(
                        select(1)
                        .select_from(PaymentTagModel)
                        .join(TagModel, TagModel.id == PaymentTagModel.tag_id)
                        .where(
                            PaymentTagModel.payment_id == PaymentModel.payment_id,
                            TagModel.name.ilike(pat, escape="\\"),
                        )
                    ),
                    exists(
                        select(1)
                        .select_from(MerchantTagLinkModel)
                        .join(TagModel, TagModel.id == MerchantTagLinkModel.tag_id)
                        .where(
                            MerchantTagLinkModel.merchant_id == PaymentModel.merchant_id,
                            TagModel.name.ilike(pat, escape="\\"),
                        )
                    ),
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

        stmt = stmt.order_by(PaymentModel.date.desc(), PaymentModel.payment_id.desc()).options(*self._load_opts())
        if limit is not None:
            stmt = stmt.limit(limit)

        result = await self._session.execute(stmt)
        return list(result.unique().scalars().all())
