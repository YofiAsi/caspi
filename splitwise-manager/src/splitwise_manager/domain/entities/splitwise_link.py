from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from splitwise_manager.domain.value_objects.enums import LinkStatus


@dataclass
class SplitwiseLink:
    payment_id: UUID
    splitwise_group_id: int
    status: LinkStatus
    splitwise_expense_id: int | None = None
    pushed_at: datetime | None = None
    last_error: str | None = None
