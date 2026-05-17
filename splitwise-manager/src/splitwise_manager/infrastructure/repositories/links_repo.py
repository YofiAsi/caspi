from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from splitwise_manager.domain.entities.splitwise_link import SplitwiseLink
from splitwise_manager.domain.repositories.links import LinkRepository
from splitwise_manager.domain.value_objects.enums import LinkStatus
from splitwise_manager.infrastructure.models import SplitwiseLinkModel


def _to_domain(row: SplitwiseLinkModel) -> SplitwiseLink:
    return SplitwiseLink(
        payment_id=row.payment_id,
        splitwise_group_id=row.splitwise_group_id,
        status=LinkStatus(row.status),
        splitwise_expense_id=row.splitwise_expense_id,
        pushed_at=row.pushed_at,
        last_error=row.last_error,
    )


class SqlLinkRepository(LinkRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get(self, payment_id: UUID) -> SplitwiseLink | None:
        result = await self._session.execute(
            select(SplitwiseLinkModel).where(SplitwiseLinkModel.payment_id == payment_id)
        )
        row = result.scalar_one_or_none()
        return _to_domain(row) if row else None

    async def upsert(self, link: SplitwiseLink) -> None:
        result = await self._session.execute(
            select(SplitwiseLinkModel).where(SplitwiseLinkModel.payment_id == link.payment_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = SplitwiseLinkModel(
                payment_id=link.payment_id,
                splitwise_group_id=link.splitwise_group_id,
                status=link.status.value,
                splitwise_expense_id=link.splitwise_expense_id,
                pushed_at=link.pushed_at,
                last_error=link.last_error,
            )
            self._session.add(row)
        else:
            row.splitwise_group_id = link.splitwise_group_id
            row.status = link.status.value
            row.splitwise_expense_id = link.splitwise_expense_id
            row.pushed_at = link.pushed_at
            row.last_error = link.last_error
        await self._session.flush()

    async def delete(self, payment_id: UUID) -> None:
        await self._session.execute(
            delete(SplitwiseLinkModel).where(SplitwiseLinkModel.payment_id == payment_id)
        )
