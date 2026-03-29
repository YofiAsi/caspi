from decimal import Decimal

from caspi.domain.entities import Payment
from caspi.domain.value_objects import (
    CategoryId,
    ImportId,
    Money,
    PaymentId,
    PaymentSource,
    PaymentType,
    SharedPayment,
    Tag,
)
from caspi.infrastructure.models import PaymentModel


def payment_model_to_domain(model: PaymentModel) -> Payment:
    shared_payment = None
    if model.share_amount is not None and model.share_currency:
        shared_payment = SharedPayment(my_share=Money(Decimal(str(model.share_amount)), model.share_currency))

    return Payment(
        payment_id=PaymentId(model.payment_id),
        amount=Money(Decimal(str(model.amount)), model.currency),
        date=model.date,
        description=model.description,
        source=PaymentSource(model.source),
        import_id=ImportId(model.import_id),
        merchant=model.merchant,
        payment_type=PaymentType(model.payment_type),
        category_id=CategoryId(model.category_id) if model.category_id else None,
        shared_payment=shared_payment,
        tags=[Tag(name=t) for t in (model.tags or [])],
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
        merchant=payment.merchant,
        share_amount=payment.shared_payment.my_share.amount if payment.shared_payment else None,
        share_currency=payment.shared_payment.my_share.currency if payment.shared_payment else None,
        payment_type=payment.payment_type.value,
        category_id=payment.category_id.value if payment.category_id else None,
        tags=[t.name for t in payment.tags],
        extra=payment.extra,
    )
