import pytest
from decimal import Decimal
from datetime import date

from caspi.domain.entities.payment import Payment
from caspi.domain.value_objects.enums import PaymentSource
from caspi.domain.value_objects.ids import ImportId, MerchantId, PaymentId
from caspi.domain.value_objects.money import Money
from caspi.domain.value_objects.shared_payment import SharedPayment


def _make_payment(amount: str = "100.00", shared: SharedPayment | None = None) -> Payment:
    return Payment(
        payment_id=PaymentId(),
        amount=Money(Decimal(amount), "ILS"),
        date=date(2025, 1, 15),
        description="Test payment",
        source=PaymentSource.ISRACARD,
        import_id=ImportId(),
        merchant_id=MerchantId(),
        merchant_canonical_name="test",
        shared_payment=shared,
    )


def test_effective_amount_no_share():
    payment = _make_payment("100.00")
    assert payment.effective_amount == Money(Decimal("100.00"), "ILS")


def test_effective_amount_with_share():
    share = SharedPayment(my_share=Money(Decimal("40.00"), "ILS"))
    payment = _make_payment("100.00", shared=share)
    assert payment.effective_amount == Money(Decimal("40.00"), "ILS")


def test_set_shared_share_exceeds_total_raises():
    payment = _make_payment("100.00")
    share = SharedPayment(my_share=Money(Decimal("150.00"), "ILS"))
    with pytest.raises(ValueError, match="my_share cannot exceed"):
        payment.set_shared(share)


def test_shared_payment_zero_share_raises():
    with pytest.raises(ValueError):
        SharedPayment(my_share=Money(Decimal("0.00"), "ILS"))
