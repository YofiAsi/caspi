import pytest
from decimal import Decimal
from datetime import date

from caspi.domain.entities.payment import Payment
from caspi.domain.value_objects.enums import PaymentSource, PaymentType
from caspi.domain.value_objects.ids import CategoryId, ImportId, PaymentId, ProjectId
from caspi.domain.value_objects.money import Money
from caspi.domain.value_objects.tag import Tag


def _make_payment() -> Payment:
    return Payment(
        payment_id=PaymentId(),
        amount=Money(Decimal("200.00"), "ILS"),
        date=date(2025, 3, 10),
        description="Supermarket",
        merchant="Shufersal",
        source=PaymentSource.ISRACARD,
        import_id=ImportId(),
    )


def test_default_payment_type_is_unknown():
    payment = _make_payment()
    assert payment.payment_type == PaymentType.UNKNOWN


def test_assign_category():
    payment = _make_payment()
    cat_id = CategoryId()
    payment.assign_category(cat_id)
    assert payment.category_id == cat_id


def test_assign_project():
    payment = _make_payment()
    proj_id = ProjectId()
    payment.assign_project(proj_id)
    assert payment.project_id == proj_id


def test_add_tag():
    payment = _make_payment()
    tag = Tag("groceries")
    payment.add_tag(tag)
    assert tag in payment.tags


def test_add_duplicate_tag_ignored():
    payment = _make_payment()
    tag = Tag("groceries")
    payment.add_tag(tag)
    payment.add_tag(tag)
    assert payment.tags.count(tag) == 1


def test_remove_tag():
    payment = _make_payment()
    tag = Tag("groceries")
    payment.add_tag(tag)
    payment.remove_tag(tag)
    assert tag not in payment.tags


def test_tag_normalization():
    assert Tag("  Groceries  ") == Tag("groceries")


def test_set_payment_type():
    payment = _make_payment()
    payment.set_payment_type(PaymentType.RECURRING)
    assert payment.payment_type == PaymentType.RECURRING
