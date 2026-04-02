from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.infrastructure.models import CollectionModel, PaymentCollectionModel, PaymentModel


async def list_collections_with_stats(
    db: AsyncSession,
) -> list[
    tuple[UUID, str, int, Decimal, date | None, date | None]
]:
    eff = func.coalesce(PaymentModel.share_amount, PaymentModel.amount)
    stmt = (
        select(
            CollectionModel.id,
            CollectionModel.name,
            func.count(PaymentModel.payment_id),
            func.coalesce(func.sum(eff), 0),
            func.min(PaymentModel.date),
            func.max(PaymentModel.date),
        )
        .select_from(CollectionModel)
        .outerjoin(
            PaymentCollectionModel,
            PaymentCollectionModel.collection_id == CollectionModel.id,
        )
        .outerjoin(
            PaymentModel,
            and_(
                PaymentModel.payment_id == PaymentCollectionModel.payment_id,
                PaymentModel.currency == "ILS",
            ),
        )
        .group_by(CollectionModel.id, CollectionModel.name)
        .order_by(CollectionModel.name)
    )
    result = await db.execute(stmt)
    out: list[tuple[UUID, str, int, Decimal, date | None, date | None]] = []
    for row in result.all():
        out.append(
            (
                row[0],
                row[1],
                int(row[2]),
                Decimal(str(row[3])),
                row[4],
                row[5],
            )
        )
    return out
