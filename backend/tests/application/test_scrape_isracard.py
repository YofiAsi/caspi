from decimal import Decimal

import pytest

from caspi.application.scrape_isracard import aligned_original_amount_for_store


def test_positive_charge_negative_foreign_amount_becomes_positive():
    charged_amount = Decimal("13.46")
    assert aligned_original_amount_for_store(charged_amount, -3.7) == pytest.approx(3.7)


def test_negative_charge_positive_foreign_amount_becomes_negative():
    charged_amount = Decimal("-16.33")
    assert aligned_original_amount_for_store(charged_amount, 4.5) == pytest.approx(-4.5)


def test_missing_original_returns_none():
    assert aligned_original_amount_for_store(Decimal("1"), None) is None


def test_zero_original_unchanged_even_when_charge_nonzero():
    assert aligned_original_amount_for_store(Decimal("5"), Decimal("0")) == 0


def test_zero_charge_preserves_original_sign():
    assert aligned_original_amount_for_store(Decimal("0"), Decimal("-2.5")) == pytest.approx(-2.5)


def test_invalid_original_returns_none():
    assert aligned_original_amount_for_store(Decimal("1"), "not-a-number") is None
