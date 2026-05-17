from decimal import Decimal

import pytest

from splitwise_manager.domain.services.share_computation_service import compute_my_share
from splitwise_manager.domain.value_objects.enums import SplitMethod


def test_equal_split_divides_evenly():
    s = compute_my_share(
        total=Decimal("100.00"),
        currency="ILS",
        method=SplitMethod.EQUAL,
        params={"member_ids": [1, 2, 1234]},
        current_user_id=1,
    )
    assert s.amount == Decimal("33.33")
    assert s.currency == "ILS"


def test_equal_split_last_member_absorbs_remainder():
    s = compute_my_share(
        total=Decimal("100.00"),
        currency="ILS",
        method=SplitMethod.EQUAL,
        params={"member_ids": [1, 2, 1234]},
        current_user_id=1234,
    )
    assert s.amount == Decimal("33.34")


def test_equal_split_preserves_sign_for_expense():
    s = compute_my_share(
        total=Decimal("-30.00"),
        currency="ILS",
        method=SplitMethod.EQUAL,
        params={"member_ids": [1, 2]},
        current_user_id=1,
    )
    assert s.amount == Decimal("-15.00")


def test_equal_split_user_not_in_members_raises():
    with pytest.raises(ValueError):
        compute_my_share(
            total=Decimal("100"),
            currency="ILS",
            method=SplitMethod.EQUAL,
            params={"member_ids": [2, 3]},
            current_user_id=1,
        )


def test_percentage_split():
    s = compute_my_share(
        total=Decimal("200.00"),
        currency="USD",
        method=SplitMethod.PERCENTAGE,
        params={"members": [{"user_id": 1, "value": 30}, {"user_id": 2, "value": 70}]},
        current_user_id=1,
    )
    assert s.amount == Decimal("60.00")


def test_percentage_split_zero_share_for_current_user():
    s = compute_my_share(
        total=Decimal("49.90"),
        currency="ILS",
        method=SplitMethod.PERCENTAGE,
        params={
            "members": [
                {"user_id": 1, "value": 0},
                {"user_id": 2, "value": 100},
            ]
        },
        current_user_id=1,
    )
    assert s.amount == Decimal("0.00")


def test_percentage_must_sum_to_100():
    with pytest.raises(ValueError):
        compute_my_share(
            total=Decimal("100"),
            currency="USD",
            method=SplitMethod.PERCENTAGE,
            params={"members": [{"user_id": 1, "value": 30}, {"user_id": 2, "value": 60}]},
            current_user_id=1,
        )


def test_shares_split():
    s = compute_my_share(
        total=Decimal("100.00"),
        currency="ILS",
        method=SplitMethod.SHARES,
        params={"members": [{"user_id": 1, "value": "25.00"}, {"user_id": 2, "value": "75.00"}]},
        current_user_id=1,
    )
    assert s.amount == Decimal("25.00")


def test_shares_must_equal_total():
    with pytest.raises(ValueError):
        compute_my_share(
            total=Decimal("100.00"),
            currency="ILS",
            method=SplitMethod.SHARES,
            params={"members": [{"user_id": 1, "value": "30"}, {"user_id": 2, "value": "60"}]},
            current_user_id=1,
        )
