from datetime import date
from decimal import Decimal

from caspi.application.payments.response_mapper import domain_payment_to_response
from caspi.domain.entities.payment import Payment
from caspi.domain.value_objects.enums import PaymentSource
from caspi.domain.value_objects.ids import ImportId, MerchantId, PaymentId
from caspi.domain.value_objects.money import Money
from caspi.domain.value_objects.shared_payment import SharedPayment


def _payment(is_shared: bool = False, *, shared: SharedPayment | None = None) -> Payment:
    return Payment(
        payment_id=PaymentId(),
        amount=Money(Decimal("100.00"), "ILS"),
        date=date(2026, 5, 17),
        description="lunch",
        source=PaymentSource.ISRACARD,
        import_id=ImportId(),
        merchant_id=MerchantId(),
        merchant_canonical_name="cafe",
        shared_payment=shared,
        is_shared=is_shared,
    )


def test_response_default_is_shared_false():
    r = domain_payment_to_response(_payment(), merchant_alias=None, merchant_tag_ids=[])
    assert r.is_shared is False
    assert r.splitwise_status is None
    assert r.share_amount is None


def test_response_includes_is_shared_true_with_share_amount():
    p = _payment(is_shared=True, shared=SharedPayment(my_share=Money(Decimal("40.00"), "ILS")))
    r = domain_payment_to_response(p, merchant_alias=None, merchant_tag_ids=[])
    assert r.is_shared is True
    assert r.share_amount == Decimal("40.00")
    assert r.share_currency == "ILS"
    assert r.effective_amount == Decimal("40.00")
