from __future__ import annotations

from dataclasses import dataclass
from typing import Callable
from uuid import UUID

from splitwise_manager.domain.repositories.outbox import OutboxRepository
from splitwise_manager.domain.value_objects.enums import OutboxOperation, OutboxStatus


@dataclass
class RetryResult:
    outbox_id: UUID | None
    requeued: bool


async def retry_payment(
    payment_id: UUID,
    *,
    outbox_repo: OutboxRepository,
    dispatch_push: Callable[[str], None] | None = None,
    dispatch_delete: Callable[[str], None] | None = None,
) -> RetryResult:
    entry = await outbox_repo.find_latest_for_payment(payment_id)
    if entry is None:
        return RetryResult(outbox_id=None, requeued=False)
    entry.attempts = 0
    entry.last_error = None
    entry.next_attempt_at = None
    entry.status = OutboxStatus.QUEUED
    await outbox_repo.update(entry)

    if entry.operation == OutboxOperation.PUSH and dispatch_push is not None:
        dispatch_push(str(entry.id))
    elif entry.operation == OutboxOperation.DELETE and dispatch_delete is not None:
        dispatch_delete(str(entry.id))
    return RetryResult(outbox_id=entry.id, requeued=True)
