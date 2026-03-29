from typing import Optional

from caspi.domain.entities import Payment
from caspi.interfaces.schemas.payments import PaymentResponse


def merchant_key(merchant: Optional[str], description: str) -> str:
    return merchant or description


def domain_payment_to_response(
    p: Payment,
    aliases: dict[str, str] | None = None,
    merchant_tags_map: dict[str, list[str]] | None = None,
) -> PaymentResponse:
    resolved_aliases = aliases or {}
    resolved_merchant_tags = merchant_tags_map or {}
    alias_key = merchant_key(p.merchant, p.description)
    alias = resolved_aliases.get(alias_key)
    display_name = alias or p.merchant or p.description
    payment_tag_names = [t.name for t in p.tags]
    merchant_tag_list = list(resolved_merchant_tags.get(alias_key, []))
    merged = sorted(set(payment_tag_names) | set(merchant_tag_list))
    return PaymentResponse(
        payment_id=str(p.payment_id.value),
        date=p.date,
        description=p.description,
        amount=p.amount.amount,
        currency=p.amount.currency,
        effective_amount=p.effective_amount.amount,
        merchant=p.merchant,
        display_name=display_name,
        merchant_alias=alias,
        payment_type=p.payment_type.value,
        payment_tags=payment_tag_names,
        merchant_tags=merchant_tag_list,
        tags=merged,
        share_amount=p.shared_payment.my_share.amount if p.shared_payment else None,
        share_currency=p.shared_payment.my_share.currency if p.shared_payment else None,
        extra=p.extra,
    )
