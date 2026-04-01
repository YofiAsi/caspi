from decimal import Decimal
from datetime import date, datetime

from caspi.domain.entities.merchant_rule import MerchantRule
from caspi.domain.entities.payment import Payment
from caspi.domain.services.categorization_service import CategorizationService, normalize_merchant
from caspi.domain.value_objects.enums import PaymentSource, PaymentType
from caspi.domain.value_objects.ids import CategoryId, ImportId, MerchantId, PaymentId, RuleId
from caspi.domain.value_objects.money import Money


def _make_payment(merchant_canonical: str) -> Payment:
    return Payment(
        payment_id=PaymentId(),
        amount=Money(Decimal("50.00"), "ILS"),
        date=date(2025, 6, 1),
        description="Test",
        source=PaymentSource.BANK,
        import_id=ImportId(),
        merchant_id=MerchantId(),
        merchant_canonical_name=merchant_canonical,
    )


def _make_rule(merchant_key: str, payment_type: PaymentType) -> MerchantRule:
    return MerchantRule(
        rule_id=RuleId(),
        merchant_key=merchant_key,
        category_id=CategoryId(),
        payment_type=payment_type,
        created_at=datetime(2025, 1, 1),
    )


def test_normalize_merchant():
    assert normalize_merchant("  Super Pharm  ") == "super pharm"
    assert normalize_merchant("SHUFERSAL") == "shufersal"


def test_empty_canonical_returns_no_result():
    service = CategorizationService()
    payment = _make_payment("")
    result = service.categorize(payment, [])
    assert result.category_id is None
    assert result.is_auto is False


def test_no_matching_rule_returns_no_result():
    service = CategorizationService()
    payment = _make_payment("super pharm")
    rule = _make_rule("shufersal", PaymentType.RECURRING)
    result = service.categorize(payment, [rule])
    assert result.category_id is None
    assert result.is_auto is False


def test_recurring_rule_auto_categorizes():
    service = CategorizationService()
    payment = _make_payment("super pharm")
    rule = _make_rule("super pharm", PaymentType.RECURRING)
    result = service.categorize(payment, [rule])
    assert result.category_id == rule.category_id
    assert result.is_auto is True
    assert result.rule == rule


def test_one_time_rule_suggests_only():
    service = CategorizationService()
    payment = _make_payment("super pharm")
    rule = _make_rule("super pharm", PaymentType.ONE_TIME)
    result = service.categorize(payment, [rule])
    assert result.category_id == rule.category_id
    assert result.is_auto is False


def test_matching_uses_canonical_name():
    service = CategorizationService()
    payment = _make_payment("super pharm")
    rule = _make_rule("super pharm", PaymentType.RECURRING)
    result = service.categorize(payment, [rule])
    assert result.category_id == rule.category_id
    assert result.is_auto is True
