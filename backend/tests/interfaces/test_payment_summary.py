from datetime import date
from decimal import Decimal
from uuid import uuid4

from caspi.application.payments.aggregate_summary import aggregate_payment_summary
from caspi.interfaces.schemas.payments import PaymentResponse


def _row(
    *,
    effective: Decimal,
    amount: Decimal | None = None,
    currency: str = "ILS",
    payment_tags: list[str] | None = None,
    merchant_tags: list[str] | None = None,
    payment_type: str = "card",
    display_name: str = "Shop",
    d: date | None = None,
) -> PaymentResponse:
    pid = str(uuid4())
    mid = str(uuid4())
    amt = amount if amount is not None else effective
    pt = payment_tags or []
    mt = merchant_tags or []
    return PaymentResponse(
        payment_id=pid,
        merchant_id=mid,
        date=d or date(2025, 1, 15),
        description="x",
        amount=amt,
        currency=currency,
        effective_amount=effective,
        display_name=display_name,
        merchant_alias=None,
        payment_type=payment_type,
        payment_tags=pt,
        merchant_tags=mt,
        collection_ids=[],
        share_amount=None,
        share_currency=None,
        extra={},
    )


def test_aggregate_empty():
    out = aggregate_payment_summary([], tag_name_by_id={})
    assert out.payment_count == 0
    assert out.totals_by_currency == []
    assert out.by_tag == []
    assert out.untagged_by_currency == []


def test_aggregate_totals_and_untagged():
    ta, tb = str(uuid4()), str(uuid4())
    rows = [
        _row(effective=Decimal("10.00"), payment_tags=[ta]),
        _row(effective=Decimal("5.00"), payment_tags=[]),
    ]
    names = {ta: "a", tb: "b"}
    out = aggregate_payment_summary(rows, tag_name_by_id=names)
    assert out.payment_count == 2
    assert len(out.totals_by_currency) == 1
    assert out.totals_by_currency[0].sum_effective == Decimal("15.00")
    assert len(out.untagged_by_currency) == 1
    assert out.untagged_by_currency[0].payment_count == 1
    assert out.untagged_by_currency[0].sum_effective == Decimal("5.00")


def test_aggregate_merged_tags_multi_tag_attribution():
    t1, t2 = str(uuid4()), str(uuid4())
    rows = [
        _row(effective=Decimal("100.00"), payment_tags=[t1], merchant_tags=[t2]),
    ]
    names = {t1: "food", t2: "work"}
    out = aggregate_payment_summary(rows, tag_name_by_id=names)
    assert len(out.by_tag) == 2
    by_name = {r.tag: r for r in out.by_tag}
    assert by_name["food"].payment_count == 1
    assert by_name["food"].sum_effective == Decimal("100.00")
    assert by_name["work"].payment_count == 1
    assert by_name["work"].sum_effective == Decimal("100.00")


def test_aggregate_by_month_and_top_merchants():
    rows = [
        _row(
            effective=Decimal("20.00"),
            display_name="A",
            d=date(2025, 2, 1),
        ),
        _row(
            effective=Decimal("30.00"),
            display_name="B",
            d=date(2025, 2, 15),
        ),
    ]
    out = aggregate_payment_summary(rows, tag_name_by_id={})
    assert len(out.by_month) == 1
    m = out.by_month[0]
    assert m.year == 2025 and m.month == 2
    assert m.payment_count == 2
    assert m.sum_effective == Decimal("50.00")
    names = [r.display_name for r in out.top_merchants]
    assert "B" in names and "A" in names


def test_aggregate_multi_currency_split():
    t = str(uuid4())
    rows = [
        _row(effective=Decimal("10.00"), currency="ILS", payment_tags=[t]),
        _row(effective=Decimal("5.00"), currency="USD", payment_tags=[t]),
    ]
    names = {t: "t"}
    out = aggregate_payment_summary(rows, tag_name_by_id=names)
    assert len(out.totals_by_currency) == 2
    assert len(out.by_tag) == 2
    curs = {r.currency for r in out.by_tag}
    assert curs == {"ILS", "USD"}
