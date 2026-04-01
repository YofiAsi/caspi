from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.payments.response_mapper import domain_payment_to_response
from caspi.domain.entities import Payment
from caspi.domain.value_objects.enums import PaymentType
from caspi.domain.value_objects.ids import PaymentId
from caspi.domain.value_objects.money import Money
from caspi.domain.value_objects.shared_payment import SharedPayment
from caspi.infrastructure.models import CollectionModel, TagModel
from caspi.infrastructure.repositories.merchant_repository import SqlMerchantRepository
from caspi.infrastructure.repositories.payment_repository import SqlPaymentRepository
from caspi.interfaces.schemas.payments import PatchPaymentBody, PaymentResponse


class PaymentPatchValidationError(ValueError):
    pass


async def _validate_tag_ids(db: AsyncSession, ids: list[UUID]) -> None:
    if not ids:
        return
    u = set(ids)
    result = await db.execute(select(TagModel.id).where(TagModel.id.in_(u)))
    found = set(result.scalars().all())
    if found != u:
        raise PaymentPatchValidationError("One or more tag ids are invalid")


async def _validate_collection_ids(db: AsyncSession, ids: list[UUID]) -> None:
    if not ids:
        return
    u = set(ids)
    result = await db.execute(select(CollectionModel.id).where(CollectionModel.id.in_(u)))
    found = set(result.scalars().all())
    if found != u:
        raise PaymentPatchValidationError("One or more collection ids are invalid")


async def apply_payment_patch(
    db: AsyncSession,
    payment: Payment,
    body: PatchPaymentBody,
) -> None:
    update = body.model_dump(exclude_unset=True)

    if "payment_tags" in update:
        pids = list(dict.fromkeys(UUID(x) for x in update["payment_tags"]))
        await _validate_tag_ids(db, pids)
        payment.set_payment_tag_ids(pids)

    if "collection_ids" in update:
        cids = list(dict.fromkeys(UUID(x) for x in update["collection_ids"]))
        await _validate_collection_ids(db, cids)
        payment.set_collection_ids(cids)

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

    merchant_repo = SqlMerchantRepository(db)
    if "merchant_alias" in update:
        await merchant_repo.set_alias(payment.merchant_id, body.merchant_alias)

    if "merchant_tags" in update:
        mids = list(dict.fromkeys(UUID(x) for x in update["merchant_tags"]))
        await _validate_tag_ids(db, mids)
        await merchant_repo.replace_tag_ids(payment.merchant_id, mids)

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

    payment = await repo.find_by_id(payment_id)
    if not payment:
        return None

    merchant_repo = SqlMerchantRepository(db)
    merchant_tag_map = await merchant_repo.load_tag_ids_by_merchant()
    from caspi.infrastructure.models import MerchantModel

    mrow = await db.get(MerchantModel, payment.merchant_id.value)
    alias = mrow.alias if mrow else None
    mt = merchant_tag_map.get(payment.merchant_id.value, [])
    return domain_payment_to_response(
        payment,
        merchant_alias=alias,
        merchant_tag_ids=mt,
    )
