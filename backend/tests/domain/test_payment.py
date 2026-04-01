from decimal import Decimal
from datetime import date
from uuid import uuid4

from caspi.domain.entities.payment import Payment
from caspi.domain.value_objects.enums import PaymentSource, PaymentType
from caspi.domain.value_objects.ids import CategoryId, ImportId, MerchantId, PaymentId
from caspi.domain.value_objects.money import Money


def _make_payment() -> Payment:
    return Payment(
        payment_id=PaymentId(),
        amount=Money(Decimal("200.00"), "ILS"),
        date=date(2025, 3, 10),
        description="Supermarket",
        source=PaymentSource.ISRACARD,
        import_id=ImportId(),
        merchant_id=MerchantId(),
        merchant_canonical_name="shufersal",
    )


def test_default_payment_type_is_unknown():
    payment = _make_payment()
    assert payment.payment_type == PaymentType.UNKNOWN


def test_assign_category():
    payment = _make_payment()
    cat_id = CategoryId()
    payment.assign_category(cat_id)
    assert payment.category_id == cat_id


def test_set_payment_tag_ids_dedupes():
    payment = _make_payment()
    a, b = uuid4(), uuid4()
    payment.set_payment_tag_ids([a, b, a])
    assert payment.payment_tag_ids == [a, b]


def test_set_payment_type():
    payment = _make_payment()
    payment.set_payment_type(PaymentType.RECURRING)
    assert payment.payment_type == PaymentType.RECURRING
