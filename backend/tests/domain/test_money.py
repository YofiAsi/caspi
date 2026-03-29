import pytest
from decimal import Decimal

from caspi.domain.value_objects.money import Money


def test_add_same_currency():
    a = Money(Decimal("10.00"), "ILS")
    b = Money(Decimal("5.50"), "ILS")
    assert a + b == Money(Decimal("15.50"), "ILS")


def test_add_different_currency_raises():
    a = Money(Decimal("10.00"), "ILS")
    b = Money(Decimal("5.00"), "USD")
    with pytest.raises(ValueError, match="Currency mismatch"):
        _ = a + b


def test_subtract():
    a = Money(Decimal("10.00"), "ILS")
    b = Money(Decimal("3.00"), "ILS")
    assert a - b == Money(Decimal("7.00"), "ILS")


def test_subtract_can_go_negative():
    a = Money(Decimal("3.00"), "ILS")
    b = Money(Decimal("10.00"), "ILS")
    assert a - b == Money(Decimal("-7.00"), "ILS")


def test_multiply():
    a = Money(Decimal("10.00"), "ILS")
    assert a * 2 == Money(Decimal("20.00"), "ILS")


def test_negative_amount_allowed_for_signed_transactions():
    m = Money(Decimal("-1.00"), "ILS")
    assert m.amount == Decimal("-1.00")


def test_empty_currency_raises():
    with pytest.raises(ValueError):
        Money(Decimal("10.00"), "")


def test_equality():
    assert Money(Decimal("10.00"), "ILS") == Money(Decimal("10.00"), "ILS")
    assert Money(Decimal("10.00"), "ILS") != Money(Decimal("10.01"), "ILS")


def test_less_than():
    a = Money(Decimal("5.00"), "ILS")
    b = Money(Decimal("10.00"), "ILS")
    assert a < b
    assert not b < a
