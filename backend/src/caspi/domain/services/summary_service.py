from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal

from caspi.domain.entities.payment import Payment
from caspi.domain.value_objects.ids import CategoryId
from caspi.domain.value_objects.money import Money
from caspi.domain.value_objects.tag import Tag


@dataclass
class PeriodTotal:
    year: int
    month: int | None
    total: Money


@dataclass
class CategoryTotal:
    category_id: CategoryId | None
    total: Money


@dataclass
class TagTotal:
    tag: Tag
    total: Money


class SummaryService:
    def total_by_category(self, payments: list[Payment]) -> list[CategoryTotal]:
        buckets: dict[CategoryId | None, Money] = defaultdict(lambda: Money(Decimal(0), self._currency(payments)))
        for payment in payments:
            buckets[payment.category_id] = buckets[payment.category_id] + payment.effective_amount
        return [CategoryTotal(category_id=cid, total=total) for cid, total in buckets.items()]

    def total_by_month(self, payments: list[Payment]) -> list[PeriodTotal]:
        buckets: dict[tuple[int, int], Money] = defaultdict(lambda: Money(Decimal(0), self._currency(payments)))
        for payment in payments:
            key = (payment.date.year, payment.date.month)
            buckets[key] = buckets[key] + payment.effective_amount
        return [
            PeriodTotal(year=year, month=month, total=total)
            for (year, month), total in sorted(buckets.items())
        ]

    def total_by_year(self, payments: list[Payment]) -> list[PeriodTotal]:
        buckets: dict[int, Money] = defaultdict(lambda: Money(Decimal(0), self._currency(payments)))
        for payment in payments:
            buckets[payment.date.year] = buckets[payment.date.year] + payment.effective_amount
        return [
            PeriodTotal(year=year, month=None, total=total)
            for year, total in sorted(buckets.items())
        ]

    def total_by_tag(self, payments: list[Payment]) -> list[TagTotal]:
        buckets: dict[Tag, Money] = defaultdict(lambda: Money(Decimal(0), self._currency(payments)))
        for payment in payments:
            for tag in payment.tags:
                buckets[tag] = buckets[tag] + payment.effective_amount
        return [TagTotal(tag=tag, total=total) for tag, total in buckets.items()]

    def grand_total(self, payments: list[Payment]) -> Money:
        if not payments:
            raise ValueError("Cannot compute total of empty payment list")
        total = Money(Decimal(0), payments[0].effective_amount.currency)
        for payment in payments:
            total = total + payment.effective_amount
        return total

    def _currency(self, payments: list[Payment]) -> str:
        if not payments:
            return "ILS"
        return payments[0].effective_amount.currency
