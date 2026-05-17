from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

from splitwise_manager.domain.value_objects.enums import OutboxOperation, OutboxStatus


@dataclass
class OutboxEntry:
    operation: OutboxOperation
    payload: dict
    payment_id: UUID | None = None
    id: UUID | None = None
    attempts: int = 0
    next_attempt_at: datetime | None = None
    last_error: str | None = None
    status: OutboxStatus = OutboxStatus.QUEUED
    created_at: datetime | None = None
    updated_at: datetime | None = None

    def __post_init__(self) -> None:
        if self.id is None:
            self.id = uuid4()
