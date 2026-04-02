from datetime import date
from decimal import Decimal
from uuid import uuid4

from caspi.application.payments.aggregate_full_tag_slices import aggregate_full_merged_tag_slices
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


def test_full_slices_empty():
    out = aggregate_full_merged_tag_slices([], tag_name_by_id={})
    assert out.payment_count == 0
    assert out.slices == []


def test_full_slices_untagged_and_combo():
    t1, t2 = str(uuid4()), str(uuid4())
    names = {t1: "a", t2: "b"}
    rows = [
        _row(effective=Decimal("10")),
        _row(effective=Decimal("20"), payment_tags=[t1]),
        _row(effective=Decimal("30"), payment_tags=[t1], merchant_tags=[t2]),
    ]
    out = aggregate_full_merged_tag_slices(rows, tag_name_by_id=names)
    assert out.payment_count == 3
    labels = {s.label: s for s in out.slices}
    assert "Untagged" in labels
    assert labels["Untagged"].sum_effective == Decimal("10")
    assert "a + b" in labels or any("a" in s.label and "b" in s.label for s in out.slices)


def test_full_slices_top_n_other():
    tags = [str(uuid4()) for _ in range(7)]
    names = {x: f"t{i}" for i, x in enumerate(tags)}
    rows = [_row(effective=Decimal(str(100 - i)), payment_tags=[tags[i]]) for i in range(7)]
    out = aggregate_full_merged_tag_slices(rows, tag_name_by_id=names, top_n=5)
    assert any(s.is_other for s in out.slices)
