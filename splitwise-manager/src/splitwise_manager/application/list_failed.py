from __future__ import annotations

from splitwise_manager.domain.entities.splitwise_outbox_entry import OutboxEntry
from splitwise_manager.domain.repositories.outbox import OutboxRepository
from splitwise_manager.domain.value_objects.enums import OutboxStatus


async def list_failed(*, outbox_repo: OutboxRepository, limit: int = 100) -> list[OutboxEntry]:
    return await outbox_repo.list_by_status(OutboxStatus.FAILED, limit=limit)
