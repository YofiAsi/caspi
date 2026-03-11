from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from caspi.domain.value_objects.enums import PaymentSource, PaymentType
from caspi.domain.value_objects.ids import CategoryId, PaymentId, RuleId
from caspi.domain.value_objects.money import Money


@dataclass(frozen=True)
class DomainEvent:
    occurred_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(frozen=True)
class PaymentImported(DomainEvent):
    payment_id: PaymentId
    source: PaymentSource
    amount: Money
    date: datetime


@dataclass(frozen=True)
class PaymentCategorized(DomainEvent):
    payment_id: PaymentId
    category_id: CategoryId


@dataclass(frozen=True)
class MerchantRuleCreated(DomainEvent):
    rule_id: RuleId
    merchant_key: str
    category_id: CategoryId
    payment_type: PaymentType
