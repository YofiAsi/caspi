from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

from splitwise_manager.domain.value_objects.enums import SplitMethod


@dataclass
class MerchantShareRule:
    merchant_id: UUID
    enabled: bool
    splitwise_group_id: int
    split_method: SplitMethod
    split_params: dict
    currency: str = "ILS"
    id: UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    def __post_init__(self) -> None:
        if self.id is None:
            self.id = uuid4()
