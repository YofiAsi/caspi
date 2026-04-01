from decimal import Decimal

from caspi.domain.entities import Payment
from caspi.domain.value_objects import (
    CategoryId,
    ImportId,
    MerchantId,
    Money,
    PaymentId,
    PaymentSource,
    PaymentType,
    SharedPayment,
)
from caspi.infrastructure.models import PaymentModel


def payment_model_to_domain(model: PaymentModel) -> Payment:
    shared_payment = None
    if model.share_amount is not None and model.share_currency:
        shared_payment = SharedPayment(my_share=Money(Decimal(str(model.share_amount)), model.share_currency))

    tag_ids = sorted({pt.tag_id for pt in (model.payment_tags or [])})
    coll_ids = sorted({pc.collection_id for pc in (model.payment_collections or [])})
    canon = model.merchant.canonical_name if model.merchant is not None else ""

    return Payment(
        payment_id=PaymentId(model.payment_id),
        amount=Money(Decimal(str(model.amount)), model.currency),
        date=model.date,
        description=model.description,
        source=PaymentSource(model.source),
        import_id=ImportId(model.import_id),
        merchant_id=MerchantId(model.merchant_id),
        merchant_canonical_name=canon,
        payment_type=PaymentType(model.payment_type),
        category_id=CategoryId(model.category_id) if model.category_id else None,
        shared_payment=shared_payment,
        payment_tag_ids=tag_ids,
        collection_ids=coll_ids,
        extra=model.extra or {},
    )


def payment_domain_to_model(payment: Payment) -> PaymentModel:
    identifier = payment.extra.get("identifier")
    return PaymentModel(
        payment_id=payment.payment_id.value,
        amount=payment.amount.amount,
        currency=payment.amount.currency,
        date=payment.date,
        description=payment.description,
        source=payment.source.value,
        import_id=payment.import_id.value,
        source_identifier=str(identifier) if identifier is not None else None,
        merchant_id=payment.merchant_id.value,
        share_amount=payment.shared_payment.my_share.amount if payment.shared_payment else None,
        share_currency=payment.shared_payment.my_share.currency if payment.shared_payment else None,
        payment_type=payment.payment_type.value,
        category_id=payment.category_id.value if payment.category_id else None,
        extra=payment.extra,
    )
