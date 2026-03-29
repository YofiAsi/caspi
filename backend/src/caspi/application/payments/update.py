from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.payments.response_mapper import domain_payment_to_response, merchant_key
from caspi.domain.entities import Payment
from caspi.domain.value_objects.enums import PaymentType
from caspi.domain.value_objects.ids import PaymentId
from caspi.domain.value_objects.money import Money
from caspi.domain.value_objects.shared_payment import SharedPayment
from caspi.domain.value_objects.tag import Tag
from caspi.infrastructure.repositories.merchant_alias_repository import SqlMerchantAliasRepository
from caspi.infrastructure.repositories.merchant_tag_repository import SqlMerchantTagRepository
from caspi.infrastructure.repositories.payment_repository import SqlPaymentRepository
from caspi.interfaces.schemas.payments import PatchPaymentBody, PaymentResponse


class PaymentPatchValidationError(ValueError):
    pass


async def apply_payment_patch(
    db: AsyncSession,
    payment: Payment,
    body: PatchPaymentBody,
) -> None:
    update = body.model_dump(exclude_unset=True)
    if "payment_tags" in update:
        payment.tags = [Tag(name=t) for t in update["payment_tags"]]
    elif "tags" in update:
        payment.tags = [Tag(name=t) for t in update["tags"]]

    if body.payment_type is not None:
        try:
            payment.payment_type = PaymentType(body.payment_type)
        except ValueError as e:
            raise PaymentPatchValidationError(f"Invalid payment_type: {body.payment_type}") from e

    if "share_amount" in update:
        if update["share_amount"] is None:
            payment.shared_payment = None
        else:
            currency = body.share_currency or (
                payment.shared_payment.my_share.currency if payment.shared_payment else payment.amount.currency
            )
            payment.shared_payment = SharedPayment(my_share=Money(body.share_amount, currency))
    elif "share_currency" in update and update["share_currency"] is not None:
        if payment.shared_payment:
            payment.shared_payment = SharedPayment(
                my_share=Money(payment.shared_payment.my_share.amount, body.share_currency)
            )

    alias_repo = SqlMerchantAliasRepository(db)
    if "merchant_alias" in update:
        alias_key = payment.merchant or payment.description
        await alias_repo.set_alias(alias_key, body.merchant_alias)

    if "merchant_tags" in update:
        mk = merchant_key(payment.merchant, payment.description)
        tag_repo = SqlMerchantTagRepository(db)
        await tag_repo.replace_tags_for_merchant(mk, update["merchant_tags"])

    repo = SqlPaymentRepository(db)
    await repo.save(payment)


async def patch_payment_by_id(
    db: AsyncSession, payment_id: PaymentId, body: PatchPaymentBody
) -> PaymentResponse | None:
    repo = SqlPaymentRepository(db)
    payment = await repo.find_by_id(payment_id)
    if not payment:
        return None

    await apply_payment_patch(db, payment, body)
    await db.commit()

    alias_repo = SqlMerchantAliasRepository(db)
    tag_repo = SqlMerchantTagRepository(db)
    aliases = await alias_repo.load_all_map()
    merchant_tags_map = await tag_repo.load_all_map()
    return domain_payment_to_response(payment, aliases, merchant_tags_map)
