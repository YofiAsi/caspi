from datetime import date
from decimal import Decimal
from uuid import uuid4

from caspi.application.payments.aggregate_month_tag_slices import aggregate_month_tag_slices
from caspi.interfaces.schemas.payments import PaymentResponse


def _row(
    *,
    effective: Decimal,
    payment_tags: list[str] | None = None,
    merchant_tags: list[str] | None = None,
    d: date | None = None,
    currency: str = "ILS",
) -> PaymentResponse:
    pid = str(uuid4())
    mid = str(uuid4())
    pt = payment_tags or []
    mt = merchant_tags or []
    return PaymentResponse(
        payment_id=pid,
        merchant_id=mid,
        date=d or date(2025, 3, 10),
        description="x",
        amount=effective,
        currency=currency,
        effective_amount=effective,
        display_name="Shop",
        merchant_alias=None,
        payment_type="card",
        payment_tags=pt,
        merchant_tags=mt,
        collection_ids=[],
        share_amount=None,
        share_currency=None,
        extra={},
    )


def test_month_slices_empty():
    t = str(uuid4())
    out = aggregate_month_tag_slices([], filter_tag_id=t, tag_name_by_id={t: "food"})
    assert out.payment_count == 0
    assert out.slices == []


def test_month_slices_no_other_tags_and_combo():
    food, out_tag, deliv = str(uuid4()), str(uuid4()), str(uuid4())
    names = {food: "food", out_tag: "outside", deliv: "delivery"}
    rows = [
        _row(effective=Decimal("10"), payment_tags=[food]),
        _row(effective=Decimal("20"), payment_tags=[food, out_tag]),
        _row(effective=Decimal("30"), payment_tags=[food], merchant_tags=[deliv]),
    ]
    out = aggregate_month_tag_slices(rows, filter_tag_id=food, tag_name_by_id=names)
    assert out.payment_count == 3
    assert out.month_total_effective == Decimal("60")
    labels = {s.label: s for s in out.slices}
    assert "No other tags" in labels
    assert labels["No other tags"].sum_effective == Decimal("10")


def test_month_slices_top_n_other():
    food = str(uuid4())
    extras = [str(uuid4()) for _ in range(7)]
    names = {food: "food", **{x: f"t{i}" for i, x in enumerate(extras)}}
    rows = []
    for i, x in enumerate(extras):
        rows.append(_row(effective=Decimal(str(100 - i)), payment_tags=[food, x]))
    out = aggregate_month_tag_slices(rows, filter_tag_id=food, tag_name_by_id=names, top_n=5)
    assert any(s.is_other for s in out.slices)
    other = [s for s in out.slices if s.is_other]
    assert len(other) == 1


def test_non_ils_excluded():
    food, x = str(uuid4()), str(uuid4())
    rows = [
        _row(effective=Decimal("10"), payment_tags=[food, x], currency="USD"),
        _row(effective=Decimal("5"), payment_tags=[food], currency="ILS"),
    ]
    out = aggregate_month_tag_slices(
        rows, filter_tag_id=food, tag_name_by_id={food: "f", x: "x"}, currency="ILS"
    )
    assert out.payment_count == 1
    assert out.month_total_effective == Decimal("5")
