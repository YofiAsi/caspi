from sqlalchemy import delete, exists, or_, select
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.domain.entities import Payment
from caspi.domain.repositories import PaymentRepository
from caspi.domain.value_objects import (
    CategoryId,
    DateRange,
    ImportId,
    PaymentId,
    PaymentSource,
    Tag,
)
from caspi.infrastructure.models import (
    MerchantTagLinkModel,
    PaymentCollectionModel,
    PaymentModel,
    PaymentTagModel,
    TagModel,
)
from caspi.infrastructure.repositories.payment_mapper import payment_domain_to_model, payment_model_to_domain


class SqlPaymentRepository(PaymentRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    def _load_opts(self):
        return (
            joinedload(PaymentModel.merchant),
            selectinload(PaymentModel.payment_tags),
            selectinload(PaymentModel.payment_collections),
        )

    async def save(self, payment: Payment) -> None:
        existing = await self._session.get(
            PaymentModel,
            payment.payment_id.value,
            options=self._load_opts(),
        )
        if existing:
            existing.amount = payment.amount.amount
            existing.currency = payment.amount.currency
            existing.date = payment.date
            existing.description = payment.description
            existing.merchant_id = payment.merchant_id.value
            existing.payment_type = payment.payment_type.value
            existing.category_id = payment.category_id.value if payment.category_id else None
            existing.extra = payment.extra
            existing.share_amount = payment.shared_payment.my_share.amount if payment.shared_payment else None
            existing.share_currency = payment.shared_payment.my_share.currency if payment.shared_payment else None
            await self._session.execute(
                delete(PaymentTagModel).where(PaymentTagModel.payment_id == existing.payment_id)
            )
            for tid in payment.payment_tag_ids:
                self._session.add(
                    PaymentTagModel(payment_id=existing.payment_id, tag_id=tid),
                )
            await self._session.execute(
                delete(PaymentCollectionModel).where(PaymentCollectionModel.payment_id == existing.payment_id)
            )
            for cid in payment.collection_ids:
                self._session.add(
                    PaymentCollectionModel(payment_id=existing.payment_id, collection_id=cid),
                )
        else:
            pm = payment_domain_to_model(payment)
            self._session.add(pm)
            await self._session.flush()
            for tid in payment.payment_tag_ids:
                self._session.add(PaymentTagModel(payment_id=pm.payment_id, tag_id=tid))
            for cid in payment.collection_ids:
                self._session.add(PaymentCollectionModel(payment_id=pm.payment_id, collection_id=cid))

    async def find_by_id(self, payment_id: PaymentId) -> Payment | None:
        result = await self._session.execute(
            select(PaymentModel)
            .where(PaymentModel.payment_id == payment_id.value)
            .options(*self._load_opts())
        )
        model = result.unique().scalar_one_or_none()
        return payment_model_to_domain(model) if model else None

    async def find_by_date_range(self, date_range: DateRange) -> list[Payment]:
        result = await self._session.execute(
            select(PaymentModel)
            .where(
                PaymentModel.date >= date_range.start,
                PaymentModel.date <= date_range.end,
            )
            .options(*self._load_opts())
        )
        return [payment_model_to_domain(m) for m in result.unique().scalars().all()]

    async def find_by_category(self, category_id: CategoryId) -> list[Payment]:
        result = await self._session.execute(
            select(PaymentModel)
            .where(PaymentModel.category_id == category_id.value)
            .options(*self._load_opts())
        )
        return [payment_model_to_domain(m) for m in result.unique().scalars().all()]

    async def find_by_import(self, import_id: ImportId) -> list[Payment]:
        result = await self._session.execute(
            select(PaymentModel)
            .where(PaymentModel.import_id == import_id.value)
            .options(*self._load_opts())
        )
        return [payment_model_to_domain(m) for m in result.unique().scalars().all()]

    async def find_by_tag(self, tag: Tag) -> list[Payment]:
        r = await self._session.execute(select(TagModel.id).where(TagModel.name == tag.name))
        tid = r.scalar_one_or_none()
        if tid is None:
            return []
        pt_exists = exists(
            select(1).where(
                PaymentTagModel.payment_id == PaymentModel.payment_id,
                PaymentTagModel.tag_id == tid,
            )
        )
        mt_exists = exists(
            select(1).where(
                MerchantTagLinkModel.merchant_id == PaymentModel.merchant_id,
                MerchantTagLinkModel.tag_id == tid,
            )
        )
        result = await self._session.execute(
            select(PaymentModel)
            .where(or_(pt_exists, mt_exists))
            .options(*self._load_opts())
        )
        return [payment_model_to_domain(m) for m in result.unique().scalars().all()]

    async def find_uncategorized(self) -> list[Payment]:
        result = await self._session.execute(
            select(PaymentModel)
            .where(PaymentModel.category_id.is_(None))
            .options(*self._load_opts())
        )
        return [payment_model_to_domain(m) for m in result.unique().scalars().all()]

    async def find_source_identifiers(self, source: PaymentSource) -> set[str]:
        result = await self._session.execute(
            select(PaymentModel.source_identifier).where(
                PaymentModel.source == source.value,
                PaymentModel.source_identifier.is_not(None),
            )
        )
        return {row[0] for row in result.all()}
