from __future__ import annotations

import asyncio
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from splitwise import Splitwise
from splitwise.expense import Expense
from splitwise.user import ExpenseUser

from splitwise_manager.domain.value_objects.enums import SplitMethod


class SplitwiseAPIError(Exception):
    pass


@dataclass
class GroupMember:
    user_id: int
    first_name: str
    last_name: str | None


@dataclass
class Group:
    id: int
    name: str
    members: list[GroupMember]


@dataclass
class CreatedExpense:
    id: int


class SplitwiseClient:
    """Async wrapper around the sync `splitwise` PyPI SDK."""

    def __init__(self, consumer_key: str, consumer_secret: str, api_key: str):
        self._sdk = Splitwise(consumer_key, consumer_secret, api_key=api_key)

    async def validate(self) -> int:
        def _call() -> int:
            user = self._sdk.getCurrentUser()
            if user is None:
                raise SplitwiseAPIError("getCurrentUser returned None")
            return int(user.getId())

        try:
            return await asyncio.to_thread(_call)
        except SplitwiseAPIError:
            raise
        except Exception as e:
            raise SplitwiseAPIError(f"validate failed: {e}") from e

    async def get_groups(self) -> list[Group]:
        def _call() -> list[Group]:
            groups = self._sdk.getGroups() or []
            out: list[Group] = []
            for g in groups:
                members: list[GroupMember] = []
                for m in (g.getMembers() or []):
                    members.append(
                        GroupMember(
                            user_id=int(m.getId()),
                            first_name=m.getFirstName() or "",
                            last_name=m.getLastName(),
                        )
                    )
                out.append(Group(id=int(g.getId()), name=g.getName() or "", members=members))
            return out

        try:
            return await asyncio.to_thread(_call)
        except Exception as e:
            raise SplitwiseAPIError(f"get_groups failed: {e}") from e

    async def create_expense(
        self,
        *,
        group_id: int,
        cost: Decimal,
        currency: str,
        description: str,
        date_iso: str | None,
        split_method: SplitMethod,
        split_params: dict,
        current_user_id: int,
    ) -> CreatedExpense:
        def _call() -> CreatedExpense:
            expense = Expense()
            expense.setCost(str(cost))
            expense.setCurrencyCode(currency)
            expense.setDescription(description)
            expense.setGroupId(group_id)
            if date_iso:
                expense.setDate(date_iso)

            users = _build_expense_users(
                total=cost,
                method=split_method,
                params=split_params,
                current_user_id=current_user_id,
            )
            expense.setUsers(users)

            created, errors = self._sdk.createExpense(expense)
            if errors and getattr(errors, "getErrors", lambda: None)():
                raise SplitwiseAPIError(f"create_expense errors: {errors.getErrors()}")
            if created is None:
                raise SplitwiseAPIError("create_expense returned None")
            return CreatedExpense(id=int(created.getId()))

        try:
            return await asyncio.to_thread(_call)
        except SplitwiseAPIError:
            raise
        except Exception as e:
            raise SplitwiseAPIError(f"create_expense failed: {e}") from e

    async def delete_expense(self, expense_id: int) -> None:
        def _call() -> None:
            ok, errors = self._sdk.deleteExpense(expense_id)
            if not ok:
                msg = errors.getErrors() if errors and hasattr(errors, "getErrors") else "unknown"
                raise SplitwiseAPIError(f"delete_expense failed: {msg}")

        try:
            await asyncio.to_thread(_call)
        except SplitwiseAPIError:
            raise
        except Exception as e:
            raise SplitwiseAPIError(f"delete_expense failed: {e}") from e


def _build_expense_users(
    *,
    total: Decimal,
    method: SplitMethod,
    params: dict,
    current_user_id: int,
) -> list[Any]:
    from decimal import ROUND_HALF_UP

    def q(x: Decimal) -> Decimal:
        return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    members_input: list[dict] = []
    if method == SplitMethod.EQUAL:
        ids = list(params.get("member_ids") or [])
        if not ids:
            raise SplitwiseAPIError("equal split requires member_ids")
        n = len(ids)
        even = q(total / Decimal(n))
        for i, uid in enumerate(ids):
            owed = even if i < n - 1 else q(total - even * Decimal(n - 1))
            members_input.append({"user_id": int(uid), "owed": owed})
    elif method == SplitMethod.PERCENTAGE:
        ms = list(params.get("members") or [])
        for m in ms:
            pct = Decimal(str(m.get("value", 0)))
            members_input.append({"user_id": int(m["user_id"]), "owed": q(total * pct / Decimal("100"))})
    elif method == SplitMethod.SHARES:
        ms = list(params.get("members") or [])
        for m in ms:
            members_input.append({"user_id": int(m["user_id"]), "owed": q(Decimal(str(m["value"])))})
    else:
        raise SplitwiseAPIError(f"unsupported split method: {method}")

    # Payer is the current user — they "paid" the full total.
    users: list[Any] = []
    for entry in members_input:
        u = ExpenseUser()
        u.setId(entry["user_id"])
        paid = total if entry["user_id"] == current_user_id else Decimal("0")
        u.setPaidShare(str(paid))
        u.setOwedShare(str(entry["owed"]))
        users.append(u)
    return users
