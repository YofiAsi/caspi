from __future__ import annotations

from dataclasses import dataclass
from typing import Callable
from uuid import UUID

from splitwise_manager.domain.entities.splitwise_outbox_entry import OutboxEntry
from splitwise_manager.domain.repositories.links import LinkRepository
from splitwise_manager.domain.repositories.outbox import OutboxRepository
from splitwise_manager.domain.value_objects.enums import OutboxOperation, OutboxStatus


@dataclass
class UnshareResult:
    delete_enqueued: bool
    outbox_id: UUID | None


async def unshare_payment(
    *,
    payment_id: UUID,
    delete_remote: bool,
    link_repo: LinkRepository,
    outbox_repo: OutboxRepository,
    dispatch_delete: Callable[[str], None] | None = None,
) -> UnshareResult:
    existing = await link_repo.get(payment_id)
    if existing is None:
        return UnshareResult(delete_enqueued=False, outbox_id=None)

    if not delete_remote or existing.splitwise_expense_id is None:
        await link_repo.delete(payment_id)
        return UnshareResult(delete_enqueued=False, outbox_id=None)

    entry = OutboxEntry(
        operation=OutboxOperation.DELETE,
        payload={"splitwise_expense_id": existing.splitwise_expense_id},
        payment_id=payment_id,
        status=OutboxStatus.QUEUED,
    )
    await outbox_repo.add(entry)
    if dispatch_delete is not None:
        dispatch_delete(str(entry.id))
    return UnshareResult(delete_enqueued=True, outbox_id=entry.id)
