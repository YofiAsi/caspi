from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from caspi.domain.value_objects.enums import ShareType
from caspi.domain.value_objects.ids import RuleId


@dataclass
class SharingRule:
    rule_id: RuleId
    merchant_key: str
    share_type: ShareType
    share_value: Decimal
    currency: str
    created_at: datetime
    label: str | None = None

    def __post_init__(self) -> None:
        if not self.merchant_key.strip():
            raise ValueError("merchant_key must not be empty")
        if self.share_type == ShareType.PERCENTAGE and not (0 < self.share_value <= 100):
            raise ValueError("percentage share_value must be between 0 and 100")
        if self.share_value <= 0:
            raise ValueError("share_value must be greater than zero")

    def matches(self, text: str) -> bool:
        return self.merchant_key.lower() in text.lower()
