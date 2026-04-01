from uuid import UUID

from caspi.domain.entities import Payment
from caspi.interfaces.schemas.payments import PaymentResponse


def domain_payment_to_response(
    p: Payment,
    *,
    merchant_alias: str | None,
    merchant_tag_ids: list[UUID],
) -> PaymentResponse:
    display_name = (merchant_alias.strip() if merchant_alias else None) or p.merchant_canonical_name
    return PaymentResponse(
        payment_id=str(p.payment_id.value),
        merchant_id=str(p.merchant_id.value),
        date=p.date,
        description=p.description,
        amount=p.amount.amount,
        currency=p.amount.currency,
        effective_amount=p.effective_amount.amount,
        display_name=display_name,
        merchant_alias=merchant_alias,
        payment_type=p.payment_type.value,
        payment_tags=[str(t) for t in p.payment_tag_ids],
        merchant_tags=[str(t) for t in merchant_tag_ids],
        collection_ids=[str(c) for c in p.collection_ids],
        share_amount=p.shared_payment.my_share.amount if p.shared_payment else None,
        share_currency=p.shared_payment.my_share.currency if p.shared_payment else None,
        extra=p.extra,
    )
