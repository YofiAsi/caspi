from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from caspi.domain.entities.payment import Payment
from caspi.domain.value_objects.money import Money


@dataclass
class MonthlyTrend:
    year: int
    month: int
    total: Money
    change_from_previous: Money | None
    change_percent: Decimal | None


class TrendService:
    def monthly_trend(
        self,
        payments: list[Payment],
        tag_id: UUID | None = None,
    ) -> list[MonthlyTrend]:
        filtered = payments if tag_id is None else [p for p in payments if tag_id in p.payment_tag_ids]

        currency = filtered[0].effective_amount.currency if filtered else "ILS"
        buckets: dict[tuple[int, int], Money] = {}

        for payment in filtered:
            key = (payment.date.year, payment.date.month)
            if key not in buckets:
                buckets[key] = Money(Decimal(0), currency)
            buckets[key] = buckets[key] + payment.effective_amount

        sorted_keys = sorted(buckets.keys())
        result: list[MonthlyTrend] = []

        for i, key in enumerate(sorted_keys):
            total = buckets[key]
            if i == 0:
                change = None
                change_percent = None
            else:
                prev = buckets[sorted_keys[i - 1]]
                diff = total.amount - prev.amount
                change = Money(abs(diff), currency) if diff >= 0 else Money(abs(diff), currency)
                change_percent = (
                    ((total.amount - prev.amount) / prev.amount * Decimal(100)).quantize(Decimal("0.01"))
                    if prev.amount != Decimal(0)
                    else None
                )

            result.append(
                MonthlyTrend(
                    year=key[0],
                    month=key[1],
                    total=total,
                    change_from_previous=change,
                    change_percent=change_percent,
                )
            )

        return result
