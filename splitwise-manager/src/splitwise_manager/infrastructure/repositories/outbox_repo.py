from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from splitwise_manager.domain.entities.splitwise_outbox_entry import OutboxEntry
from splitwise_manager.domain.repositories.outbox import OutboxRepository
from splitwise_manager.domain.value_objects.enums import OutboxOperation, OutboxStatus
from splitwise_manager.infrastructure.models import OutboxModel


def _to_domain(row: OutboxModel) -> OutboxEntry:
    return OutboxEntry(
        id=row.id,
        payment_id=row.payment_id,
        operation=OutboxOperation(row.operation),
        payload=row.payload or {},
        attempts=row.attempts,
        next_attempt_at=row.next_attempt_at,
        last_error=row.last_error,
        status=OutboxStatus(row.status),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class SqlOutboxRepository(OutboxRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def add(self, entry: OutboxEntry) -> None:
        row = OutboxModel(
            id=entry.id,
            payment_id=entry.payment_id,
            operation=entry.operation.value,
            payload=entry.payload,
            attempts=entry.attempts,
            next_attempt_at=entry.next_attempt_at,
            last_error=entry.last_error,
            status=entry.status.value,
        )
        self._session.add(row)
        await self._session.flush()

    async def get(self, entry_id: UUID) -> OutboxEntry | None:
        row = await self._session.get(OutboxModel, entry_id)
        return _to_domain(row) if row else None

    async def update(self, entry: OutboxEntry) -> None:
        row = await self._session.get(OutboxModel, entry.id)
        if row is None:
            return
        row.payment_id = entry.payment_id
        row.operation = entry.operation.value
        row.payload = entry.payload
        row.attempts = entry.attempts
        row.next_attempt_at = entry.next_attempt_at
        row.last_error = entry.last_error
        row.status = entry.status.value
        row.updated_at = datetime.now(timezone.utc)
        await self._session.flush()

    async def list_by_status(self, status: OutboxStatus, *, limit: int = 100) -> list[OutboxEntry]:
        result = await self._session.execute(
            select(OutboxModel)
            .where(OutboxModel.status == status.value)
            .order_by(OutboxModel.created_at.asc())
            .limit(limit)
        )
        return [_to_domain(r) for r in result.scalars().all()]

    async def list_due(self, *, limit: int = 100) -> list[OutboxEntry]:
        now = datetime.now(timezone.utc)
        result = await self._session.execute(
            select(OutboxModel)
            .where(
                OutboxModel.status == OutboxStatus.QUEUED.value,
                (OutboxModel.next_attempt_at.is_(None)) | (OutboxModel.next_attempt_at <= now),
            )
            .order_by(OutboxModel.created_at.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        return [_to_domain(r) for r in result.scalars().all()]

    async def count_by_status(self, status: OutboxStatus) -> int:
        result = await self._session.execute(
            select(func.count(OutboxModel.id)).where(OutboxModel.status == status.value)
        )
        return int(result.scalar_one())

    async def find_latest_for_payment(self, payment_id: UUID) -> OutboxEntry | None:
        result = await self._session.execute(
            select(OutboxModel)
            .where(OutboxModel.payment_id == payment_id)
            .order_by(OutboxModel.created_at.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        return _to_domain(row) if row else None
