from __future__ import annotations

from caspi.domain.entities.merchant_rule import MerchantRule
from caspi.domain.entities.payment import Payment
from caspi.domain.value_objects.enums import PaymentType
from caspi.domain.value_objects.ids import CategoryId


def normalize_merchant(name: str) -> str:
    return name.strip().lower()


class CategorizationResult:
    def __init__(self, category_id: CategoryId | None, is_auto: bool, rule: MerchantRule | None) -> None:
        self.category_id = category_id
        self.is_auto = is_auto
        self.rule = rule


class CategorizationService:
    def categorize(self, payment: Payment, rules: list[MerchantRule]) -> CategorizationResult:
        key = normalize_merchant(payment.merchant_canonical_name)
        if not key:
            return CategorizationResult(category_id=None, is_auto=False, rule=None)

        rule = next((r for r in rules if r.merchant_key == key), None)

        if rule is None:
            return CategorizationResult(category_id=None, is_auto=False, rule=None)

        if rule.payment_type == PaymentType.RECURRING:
            return CategorizationResult(category_id=rule.category_id, is_auto=True, rule=rule)

        return CategorizationResult(category_id=rule.category_id, is_auto=False, rule=rule)
