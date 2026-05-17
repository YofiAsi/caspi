from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from splitwise_manager.domain.value_objects.enums import SplitMethod
from splitwise_manager.domain.value_objects.share import Share

CENT = Decimal("0.01")


def _q(d: Decimal) -> Decimal:
    return d.quantize(CENT, rounding=ROUND_HALF_UP)


def compute_my_share(
    *,
    total: Decimal,
    currency: str,
    method: SplitMethod,
    params: dict,
    current_user_id: int,
) -> Share:
    """Compute the current user's share of a total according to a Splitwise-style split.

    `params` shape per method:
    - EQUAL:      {"member_ids": [int, ...]} — current_user_id must be in the list.
    - PERCENTAGE: {"members": [{"user_id": int, "value": float}, ...]} — values must sum to 100.
    - SHARES:     {"members": [{"user_id": int, "value": number}, ...]} — values' total currency
                  amount must equal `total`.
    """
    total_abs = total.copy_abs()
    sign = Decimal("-1") if total < 0 else Decimal("1")

    if method == SplitMethod.EQUAL:
        member_ids = list(params.get("member_ids") or [])
        if not member_ids:
            raise ValueError("equal split requires member_ids")
        if current_user_id not in member_ids:
            raise ValueError("current user is not in the split member list")
        n = len(member_ids)
        even = _q(total_abs / Decimal(n))
        # All members get `even` except the last, which absorbs rounding remainder.
        sorted_members = list(member_ids)
        is_last = sorted_members[-1] == current_user_id
        if is_last:
            others_sum = even * Decimal(n - 1)
            my = total_abs - others_sum
        else:
            my = even
        return Share(amount=_q(sign * my), currency=currency)

    if method == SplitMethod.PERCENTAGE:
        members = list(params.get("members") or [])
        if not members:
            raise ValueError("percentage split requires members")
        total_pct = sum((Decimal(str(m.get("value", 0))) for m in members), start=Decimal("0"))
        if total_pct != Decimal("100"):
            raise ValueError(f"percentage values must sum to 100 (got {total_pct})")
        match = next((m for m in members if int(m.get("user_id")) == current_user_id), None)
        if match is None:
            raise ValueError("current user is not in the split member list")
        my_pct = Decimal(str(match.get("value", 0)))
        my = _q(total_abs * my_pct / Decimal("100"))
        return Share(amount=_q(sign * my), currency=currency)

    if method == SplitMethod.SHARES:
        members = list(params.get("members") or [])
        if not members:
            raise ValueError("shares split requires members")
        s = sum((Decimal(str(m.get("value", 0))) for m in members), start=Decimal("0"))
        if _q(s) != _q(total_abs):
            raise ValueError(f"exact shares must sum to total ({total_abs}); got {s}")
        match = next((m for m in members if int(m.get("user_id")) == current_user_id), None)
        if match is None:
            raise ValueError("current user is not in the split member list")
        my = _q(Decimal(str(match.get("value", 0))))
        return Share(amount=_q(sign * my), currency=currency)

    raise ValueError(f"unsupported split method: {method}")
