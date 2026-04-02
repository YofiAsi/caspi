from collections import defaultdict
from decimal import Decimal

from caspi.interfaces.schemas.payments import MonthTagSliceRow, MonthTagSlicesResponse, PaymentResponse


def _merged_ids(r: PaymentResponse) -> set[str]:
    return set(r.payment_tags) | set(r.merchant_tags)


def _label_for_combo(ids: list[str], tag_name_by_id: dict[str, str]) -> str:
    if not ids:
        return "Untagged"
    names = sorted(tag_name_by_id.get(i, i) for i in ids)
    return " + ".join(names)


def aggregate_full_merged_tag_slices(
    responses: list[PaymentResponse],
    *,
    tag_name_by_id: dict[str, str],
    currency: str = "ILS",
    top_n: int = 5,
) -> MonthTagSlicesResponse:
    rows = [r for r in responses if r.currency == currency]

    buckets: dict[tuple[str, ...], tuple[Decimal, int]] = defaultdict(lambda: (Decimal(0), 0))
    total = Decimal(0)
    total_count = 0

    for r in rows:
        key = tuple(sorted(_merged_ids(r)))
        s, c = buckets[key]
        buckets[key] = (s + r.effective_amount, c + 1)
        total += r.effective_amount
        total_count += 1

    if total_count == 0:
        return MonthTagSlicesResponse(
            currency=currency,
            month_total_effective=Decimal(0),
            payment_count=0,
            slices=[],
        )

    ordered = sorted(buckets.items(), key=lambda kv: (-kv[1][0], kv[0]))
    top = ordered[:top_n]
    rest = ordered[top_n:]

    slice_rows: list[MonthTagSliceRow] = []
    for key, (s, c) in top:
        frac = (s / total) if total > 0 else Decimal(0)
        ids = list(key)
        slice_rows.append(
            MonthTagSliceRow(
                other_tag_ids=ids,
                label=_label_for_combo(ids, tag_name_by_id),
                sum_effective=s,
                payment_count=c,
                fraction=frac,
            )
        )

    if rest:
        rs = sum(x[1][0] for x in rest)
        rc = sum(x[1][1] for x in rest)
        frac = (rs / total) if total > 0 else Decimal(0)
        slice_rows.append(
            MonthTagSliceRow(
                other_tag_ids=[],
                label="Other",
                sum_effective=rs,
                payment_count=rc,
                fraction=frac,
                is_other=True,
            )
        )

    return MonthTagSlicesResponse(
        currency=currency,
        month_total_effective=total,
        payment_count=total_count,
        slices=slice_rows,
    )
