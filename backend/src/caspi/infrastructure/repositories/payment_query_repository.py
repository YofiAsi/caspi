from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, exists, func, not_, or_, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from caspi.infrastructure.models import (
    MerchantModel,
    MerchantTagLinkModel,
    PaymentCollectionModel,
    PaymentModel,
    PaymentTagModel,
    TagModel,
)


class PaymentListSort(str, Enum):
    date_desc = "date_desc"
    date_asc = "date_asc"
    amount_desc = "amount_desc"
    amount_asc = "amount_asc"
    merchant_asc = "merchant_asc"
    merchant_desc = "merchant_desc"


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


def _effective_amount_expr():
    return func.coalesce(PaymentModel.share_amount, PaymentModel.amount)


def _merchant_sort_key_expr():
    trimmed = func.nullif(func.trim(func.coalesce(MerchantModel.alias, "")), "")
    return func.lower(func.coalesce(trimmed, MerchantModel.canonical_name))


def _parse_sort(raw: Optional[str]) -> PaymentListSort:
    if not raw:
        return PaymentListSort.date_desc
    try:
        return PaymentListSort(raw)
    except ValueError:
        return PaymentListSort.date_desc


def _exact_merged_tag_match_conditions(target: list[UUID]) -> list:
    u = sorted(set(target), key=lambda x: str(x))
    conds = []
    if u:
        conds.append(
            not_(
                exists(
                    select(1).where(
                        PaymentTagModel.payment_id == PaymentModel.payment_id,
                        PaymentTagModel.tag_id.notin_(u),
                    )
                )
            )
        )
        conds.append(
            not_(
                exists(
                    select(1).where(
                        MerchantTagLinkModel.merchant_id == PaymentModel.merchant_id,
                        MerchantTagLinkModel.tag_id.notin_(u),
                    )
                )
            )
        )
    else:
        conds.append(
            not_(exists(select(1).where(PaymentTagModel.payment_id == PaymentModel.payment_id)))
        )
        conds.append(
            not_(
                exists(
                    select(1).where(MerchantTagLinkModel.merchant_id == PaymentModel.merchant_id)
                )
            )
        )

    if u:
        pt = (
            select(PaymentTagModel.tag_id)
            .where(PaymentTagModel.payment_id == PaymentModel.payment_id)
            .correlate(PaymentModel)
        )
        mt = (
            select(MerchantTagLinkModel.tag_id)
            .where(MerchantTagLinkModel.merchant_id == PaymentModel.merchant_id)
            .correlate(PaymentModel)
        )
        tag_union = union_all(pt, mt).subquery()
        cnt_expr = (
            select(func.count(func.distinct(tag_union.c.tag_id)))
            .select_from(tag_union)
            .scalar_subquery()
        )
        conds.append(cnt_expr == len(u))

        for tid in u:
            conds.append(
                or_(
                    exists(
                        select(1).where(
                            PaymentTagModel.payment_id == PaymentModel.payment_id,
                            PaymentTagModel.tag_id == tid,
                        )
                    ),
                    exists(
                        select(1).where(
                            MerchantTagLinkModel.merchant_id == PaymentModel.merchant_id,
                            MerchantTagLinkModel.tag_id == tid,
                        )
                    ),
                )
            )

    return conds


class SqlPaymentQueryRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    def _load_opts(self):
        return (
            joinedload(PaymentModel.merchant),
            selectinload(PaymentModel.payment_tags),
            selectinload(PaymentModel.payment_collections),
        )

    def _base_conditions(
        self,
        *,
        include_tags: Optional[list[str]],
        exclude_tags: Optional[list[str]],
        date_from: Optional[date],
        date_to: Optional[date],
        amount_min: Optional[Decimal],
        amount_max: Optional[Decimal],
        tagged_only: Optional[bool],
        search_q: Optional[str],
        currency: Optional[str],
        filter_tag_id: Optional[UUID],
        other_tag_ids: Optional[list[UUID]],
        apply_tag_slice: bool,
        collection_id: Optional[UUID] = None,
        apply_tag_combo: bool = False,
        merged_tag_ids: Optional[list[UUID]] = None,
        apply_tag_combo_other: bool = False,
        tag_combo_excludes: Optional[list[list[UUID]]] = None,
    ) -> list:
        conditions = []

        if collection_id is not None:
            conditions.append(
                exists(
                    select(1).where(
                        PaymentCollectionModel.payment_id == PaymentModel.payment_id,
                        PaymentCollectionModel.collection_id == collection_id,
                    )
                )
            )

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

        if currency is not None and str(currency).strip():
            conditions.append(PaymentModel.currency == str(currency).strip().upper())

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

        if apply_tag_slice:
            if filter_tag_id is None:
                raise ValueError("filter_tag_id is required when apply_tag_slice is set")
            ft = filter_tag_id
            oids = other_tag_ids if other_tag_ids is not None else []
            n_other = len(oids)
            pt_other = (
                select(PaymentTagModel.tag_id)
                .where(
                    PaymentTagModel.payment_id == PaymentModel.payment_id,
                    PaymentTagModel.tag_id != ft,
                )
                .correlate(PaymentModel)
            )
            mt_other = (
                select(MerchantTagLinkModel.tag_id)
                .where(
                    MerchantTagLinkModel.merchant_id == PaymentModel.merchant_id,
                    MerchantTagLinkModel.tag_id != ft,
                )
                .correlate(PaymentModel)
            )
            u = union_all(pt_other, mt_other).subquery()
            cnt = select(func.count(func.distinct(u.c.tag_id))).select_from(u).scalar_subquery()
            conditions.append(cnt == n_other)
            for oid in oids:
                has_o = or_(
                    exists(
                        select(1).where(
                            PaymentTagModel.payment_id == PaymentModel.payment_id,
                            PaymentTagModel.tag_id == oid,
                        )
                    ),
                    exists(
                        select(1).where(
                            MerchantTagLinkModel.merchant_id == PaymentModel.merchant_id,
                            MerchantTagLinkModel.tag_id == oid,
                        )
                    ),
                )
                conditions.append(has_o)

        if apply_tag_combo:
            combo = list(merged_tag_ids) if merged_tag_ids is not None else []
            conditions.extend(_exact_merged_tag_match_conditions(combo))

        if apply_tag_combo_other:
            excludes = tag_combo_excludes or []
            for ex in excludes:
                conditions.append(not_(and_(*_exact_merged_tag_match_conditions(ex))))

        return conditions

    def _cursor_condition(
        self,
        sort: PaymentListSort,
        *,
        after_date: date,
        after_payment_id: UUID,
        after_effective_amount: Optional[Decimal],
        after_merchant_key: Optional[str],
    ):
        eff = _effective_amount_expr()
        mkey = _merchant_sort_key_expr()
        if sort == PaymentListSort.date_desc:
            return or_(
                PaymentModel.date < after_date,
                and_(PaymentModel.date == after_date, PaymentModel.payment_id < after_payment_id),
            )
        if sort == PaymentListSort.date_asc:
            return or_(
                PaymentModel.date > after_date,
                and_(PaymentModel.date == after_date, PaymentModel.payment_id > after_payment_id),
            )
        if sort == PaymentListSort.amount_desc:
            if after_effective_amount is None:
                raise ValueError("after_effective_amount required for amount_desc cursor")
            ae = after_effective_amount
            return or_(
                eff < ae,
                and_(eff == ae, PaymentModel.date < after_date),
                and_(eff == ae, PaymentModel.date == after_date, PaymentModel.payment_id < after_payment_id),
            )
        if sort == PaymentListSort.amount_asc:
            if after_effective_amount is None:
                raise ValueError("after_effective_amount required for amount_asc cursor")
            ae = after_effective_amount
            return or_(
                eff > ae,
                and_(eff == ae, PaymentModel.date > after_date),
                and_(eff == ae, PaymentModel.date == after_date, PaymentModel.payment_id > after_payment_id),
            )
        if sort == PaymentListSort.merchant_asc:
            if after_merchant_key is None:
                raise ValueError("after_merchant_key required for merchant_asc cursor")
            ak = after_merchant_key
            return or_(
                mkey > ak,
                and_(mkey == ak, PaymentModel.date < after_date),
                and_(mkey == ak, PaymentModel.date == after_date, PaymentModel.payment_id < after_payment_id),
            )
        if sort == PaymentListSort.merchant_desc:
            if after_merchant_key is None:
                raise ValueError("after_merchant_key required for merchant_desc cursor")
            ak = after_merchant_key
            return or_(
                mkey < ak,
                and_(mkey == ak, PaymentModel.date < after_date),
                and_(mkey == ak, PaymentModel.date == after_date, PaymentModel.payment_id < after_payment_id),
            )
        return None

    def _order_by(self, sort: PaymentListSort):
        eff = _effective_amount_expr()
        mkey = _merchant_sort_key_expr()
        if sort == PaymentListSort.date_desc:
            return (PaymentModel.date.desc(), PaymentModel.payment_id.desc())
        if sort == PaymentListSort.date_asc:
            return (PaymentModel.date.asc(), PaymentModel.payment_id.asc())
        if sort == PaymentListSort.amount_desc:
            return (eff.desc(), PaymentModel.date.desc(), PaymentModel.payment_id.desc())
        if sort == PaymentListSort.amount_asc:
            return (eff.asc(), PaymentModel.date.asc(), PaymentModel.payment_id.asc())
        if sort == PaymentListSort.merchant_asc:
            return (mkey.asc(), PaymentModel.date.desc(), PaymentModel.payment_id.desc())
        if sort == PaymentListSort.merchant_desc:
            return (mkey.desc(), PaymentModel.date.desc(), PaymentModel.payment_id.desc())
        return (PaymentModel.date.desc(), PaymentModel.payment_id.desc())

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
        currency: Optional[str] = None,
        filter_tag_id: Optional[UUID] = None,
        other_tag_ids: Optional[list[UUID]] = None,
        apply_tag_slice: bool = False,
        sort: Optional[str] = None,
        limit: Optional[int] = None,
        after_date: Optional[date] = None,
        after_payment_id: Optional[UUID] = None,
        after_effective_amount: Optional[Decimal] = None,
        after_merchant_key: Optional[str] = None,
        collection_id: Optional[UUID] = None,
        apply_tag_combo: bool = False,
        merged_tag_ids: Optional[list[UUID]] = None,
        apply_tag_combo_other: bool = False,
        tag_combo_excludes: Optional[list[list[UUID]]] = None,
    ) -> list[PaymentModel]:
        sort_e = _parse_sort(sort)
        stmt = select(PaymentModel).outerjoin(MerchantModel, MerchantModel.id == PaymentModel.merchant_id)
        conditions = self._base_conditions(
            include_tags=include_tags,
            exclude_tags=exclude_tags,
            date_from=date_from,
            date_to=date_to,
            amount_min=amount_min,
            amount_max=amount_max,
            tagged_only=tagged_only,
            search_q=search_q,
            currency=currency,
            filter_tag_id=filter_tag_id,
            other_tag_ids=other_tag_ids,
            apply_tag_slice=apply_tag_slice,
            collection_id=collection_id,
            apply_tag_combo=apply_tag_combo,
            merged_tag_ids=merged_tag_ids,
            apply_tag_combo_other=apply_tag_combo_other,
            tag_combo_excludes=tag_combo_excludes,
        )
        if conditions:
            stmt = stmt.where(and_(*conditions))

        if after_date is not None and after_payment_id is not None:
            cur = self._cursor_condition(
                sort_e,
                after_date=after_date,
                after_payment_id=after_payment_id,
                after_effective_amount=after_effective_amount,
                after_merchant_key=after_merchant_key,
            )
            if cur is not None:
                stmt = stmt.where(cur)

        stmt = stmt.order_by(*self._order_by(sort_e)).options(*self._load_opts())
        if limit is not None:
            stmt = stmt.limit(limit)

        result = await self._session.execute(stmt)
        return list(result.unique().scalars().all())

    async def count_and_sum_effective(
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
        currency: Optional[str] = None,
        filter_tag_id: Optional[UUID] = None,
        other_tag_ids: Optional[list[UUID]] = None,
        apply_tag_slice: bool = False,
        collection_id: Optional[UUID] = None,
        apply_tag_combo: bool = False,
        merged_tag_ids: Optional[list[UUID]] = None,
        apply_tag_combo_other: bool = False,
        tag_combo_excludes: Optional[list[list[UUID]]] = None,
    ) -> tuple[int, Decimal]:
        eff = _effective_amount_expr()
        stmt = (
            select(func.count(PaymentModel.payment_id), func.coalesce(func.sum(eff), 0))
            .select_from(PaymentModel)
            .outerjoin(MerchantModel, MerchantModel.id == PaymentModel.merchant_id)
        )
        conditions = self._base_conditions(
            include_tags=include_tags,
            exclude_tags=exclude_tags,
            date_from=date_from,
            date_to=date_to,
            amount_min=amount_min,
            amount_max=amount_max,
            tagged_only=tagged_only,
            search_q=search_q,
            currency=currency,
            filter_tag_id=filter_tag_id,
            other_tag_ids=other_tag_ids,
            apply_tag_slice=apply_tag_slice,
            collection_id=collection_id,
            apply_tag_combo=apply_tag_combo,
            merged_tag_ids=merged_tag_ids,
            apply_tag_combo_other=apply_tag_combo_other,
            tag_combo_excludes=tag_combo_excludes,
        )
        if conditions:
            stmt = stmt.where(and_(*conditions))
        row = (await self._session.execute(stmt)).one()
        return int(row[0]), Decimal(str(row[1]))
