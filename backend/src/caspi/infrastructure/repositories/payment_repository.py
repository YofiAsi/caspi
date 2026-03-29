from sqlalchemy import select, and_
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
from caspi.infrastructure.models import PaymentModel
from caspi.infrastructure.repositories.payment_mapper import payment_domain_to_model, payment_model_to_domain


class SqlPaymentRepository(PaymentRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, payment: Payment) -> None:
        existing = await self._session.get(PaymentModel, payment.payment_id.value)
        if existing:
            existing.amount = payment.amount.amount
            existing.currency = payment.amount.currency
            existing.date = payment.date
            existing.description = payment.description
            existing.merchant = payment.merchant
            existing.payment_type = payment.payment_type.value
            existing.category_id = payment.category_id.value if payment.category_id else None
            existing.tags = [t.name for t in payment.tags]
            existing.extra = payment.extra
            existing.share_amount = payment.shared_payment.my_share.amount if payment.shared_payment else None
            existing.share_currency = payment.shared_payment.my_share.currency if payment.shared_payment else None
        else:
            self._session.add(payment_domain_to_model(payment))

    async def find_by_id(self, payment_id: PaymentId) -> Payment | None:
        model = await self._session.get(PaymentModel, payment_id.value)
        return payment_model_to_domain(model) if model else None

    async def find_by_date_range(self, date_range: DateRange) -> list[Payment]:
        result = await self._session.execute(
            select(PaymentModel).where(
                PaymentModel.date >= date_range.start,
                PaymentModel.date <= date_range.end,
            )
        )
        return [payment_model_to_domain(m) for m in result.scalars().all()]

    async def find_by_category(self, category_id: CategoryId) -> list[Payment]:
        result = await self._session.execute(
            select(PaymentModel).where(PaymentModel.category_id == category_id.value)
        )
        return [payment_model_to_domain(m) for m in result.scalars().all()]

    async def find_by_import(self, import_id: ImportId) -> list[Payment]:
        result = await self._session.execute(
            select(PaymentModel).where(PaymentModel.import_id == import_id.value)
        )
        return [payment_model_to_domain(m) for m in result.scalars().all()]

    async def find_by_tag(self, tag: Tag) -> list[Payment]:
        result = await self._session.execute(select(PaymentModel))
        return [
            payment_model_to_domain(m)
            for m in result.scalars().all()
            if tag.name in (m.tags or [])
        ]

    async def find_uncategorized(self) -> list[Payment]:
        result = await self._session.execute(
            select(PaymentModel).where(PaymentModel.category_id.is_(None))
        )
        return [payment_model_to_domain(m) for m in result.scalars().all()]

    async def find_source_identifiers(self, source: PaymentSource) -> set[str]:
        result = await self._session.execute(
            select(PaymentModel.source_identifier).where(
                and_(
                    PaymentModel.source == source.value,
                    PaymentModel.source_identifier.is_not(None),
                )
            )
        )
        return {row[0] for row in result.all()}
