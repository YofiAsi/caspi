from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from caspi.domain.value_objects.enums import PaymentType
from caspi.domain.value_objects.ids import CategoryId, RuleId


@dataclass
class MerchantRule:
    rule_id: RuleId
    merchant_key: str
    category_id: CategoryId
    payment_type: PaymentType
    created_at: datetime
    match_count: int = 0

    def __post_init__(self) -> None:
        if not self.merchant_key.strip():
            raise ValueError("merchant_key must not be empty")

    def record_match(self) -> None:
        self.match_count += 1

    def update_category(self, category_id: CategoryId) -> None:
        self.category_id = category_id

    def update_payment_type(self, payment_type: PaymentType) -> None:
        self.payment_type = payment_type
