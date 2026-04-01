from collections import defaultdict
from decimal import Decimal

from caspi.interfaces.schemas.payments import (
    TOP_MERCHANTS_PER_CURRENCY,
    CurrencyTotals,
    MerchantSummaryRow,
    MonthSummaryRow,
    PaymentResponse,
    PaymentSummaryResponse,
    PaymentTypeSummaryRow,
    TagSummaryRow,
    UntaggedByCurrency,
)


def _merged_tag_ids(r: PaymentResponse) -> set[str]:
    return set(r.payment_tags) | set(r.merchant_tags)


def aggregate_payment_summary(
    responses: list[PaymentResponse],
    *,
    tag_name_by_id: dict[str, str],
) -> PaymentSummaryResponse:
    if not responses:
        return PaymentSummaryResponse(
            payment_count=0,
            totals_by_currency=[],
            by_tag=[],
            untagged_by_currency=[],
            by_payment_type=[],
            top_merchants=[],
            by_month=[],
        )

    totals_eff: dict[str, Decimal] = defaultdict(lambda: Decimal(0))
    totals_amt: dict[str, Decimal] = defaultdict(lambda: Decimal(0))
    tag_sum: dict[tuple[str, str], Decimal] = defaultdict(lambda: Decimal(0))
    tag_pay_count: dict[tuple[str, str], int] = defaultdict(int)
    untagged_eff: dict[str, Decimal] = defaultdict(lambda: Decimal(0))
    untagged_count: dict[str, int] = defaultdict(int)
    ptype_sum: dict[tuple[str, str], Decimal] = defaultdict(lambda: Decimal(0))
    ptype_count: dict[tuple[str, str], int] = defaultdict(int)
    merchant_sum: dict[tuple[str, str], Decimal] = defaultdict(lambda: Decimal(0))
    merchant_count: dict[tuple[str, str], int] = defaultdict(int)
    month_sum: dict[tuple[int, int, str], Decimal] = defaultdict(lambda: Decimal(0))
    month_count: dict[tuple[int, int, str], int] = defaultdict(int)

    for r in responses:
        c = r.currency
        totals_eff[c] += r.effective_amount
        totals_amt[c] += r.amount

        merged = _merged_tag_ids(r)
        if merged:
            for tid in merged:
                label = tag_name_by_id.get(tid, tid)
                k = (tid, c)
                tag_sum[k] += r.effective_amount
                tag_pay_count[k] += 1
        else:
            untagged_eff[c] += r.effective_amount
            untagged_count[c] += 1

        pk = (r.payment_type, c)
        ptype_sum[pk] += r.effective_amount
        ptype_count[pk] += 1

        mk = (r.display_name, c)
        merchant_sum[mk] += r.effective_amount
        merchant_count[mk] += 1

        y, m = r.date.year, r.date.month
        bk = (y, m, c)
        month_sum[bk] += r.effective_amount
        month_count[bk] += 1

    totals_by_currency = [
        CurrencyTotals(currency=cur, sum_effective=totals_eff[cur], sum_amount=totals_amt[cur])
        for cur in sorted(totals_eff.keys())
    ]

    by_tag_rows = sorted(
        (
            TagSummaryRow(
                tag_id=tid,
                tag=tag_name_by_id.get(tid, tid),
                currency=cur,
                sum_effective=tag_sum[(tid, cur)],
                payment_count=tag_pay_count[(tid, cur)],
            )
            for tid, cur in tag_sum.keys()
        ),
        key=lambda row: (-row.sum_effective, row.tag),
    )

    untagged_by_currency = [
        UntaggedByCurrency(
            currency=cur,
            payment_count=untagged_count[cur],
            sum_effective=untagged_eff[cur],
        )
        for cur in sorted(untagged_eff.keys())
        if untagged_count[cur] > 0
    ]

    by_payment_type = sorted(
        (
            PaymentTypeSummaryRow(
                payment_type=pt,
                currency=cur,
                payment_count=ptype_count[(pt, cur)],
                sum_effective=ptype_sum[(pt, cur)],
            )
            for pt, cur in ptype_sum.keys()
        ),
        key=lambda row: (-row.sum_effective, row.payment_type),
    )

    top_merchants: list[MerchantSummaryRow] = []
    merchants_by_currency: dict[str, list[tuple[str, Decimal, int]]] = defaultdict(list)
    for (name, cur), s in merchant_sum.items():
        merchants_by_currency[cur].append((name, s, merchant_count[(name, cur)]))
    for cur in sorted(merchants_by_currency.keys()):
        ranked = sorted(merchants_by_currency[cur], key=lambda t: (-t[1], t[0]))[:TOP_MERCHANTS_PER_CURRENCY]
        for name, s, cnt in ranked:
            top_merchants.append(
                MerchantSummaryRow(display_name=name, currency=cur, payment_count=cnt, sum_effective=s)
            )

    by_month = sorted(
        (
            MonthSummaryRow(
                year=y,
                month=m,
                currency=cur,
                payment_count=month_count[(y, m, cur)],
                sum_effective=month_sum[(y, m, cur)],
            )
            for y, m, cur in month_sum.keys()
        ),
        key=lambda row: (row.year, row.month, row.currency),
    )

    return PaymentSummaryResponse(
        payment_count=len(responses),
        totals_by_currency=totals_by_currency,
        by_tag=by_tag_rows,
        untagged_by_currency=untagged_by_currency,
        by_payment_type=by_payment_type,
        top_merchants=top_merchants,
        by_month=by_month,
    )
