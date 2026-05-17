from datetime import date
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.payments.response_mapper import domain_payment_to_response
from caspi.application.scrape_isracard import import_isracard_accounts
from caspi.infrastructure.database import get_db
from caspi.infrastructure.models import MerchantModel
from caspi.infrastructure.repositories import (
    SqlImportBatchRepository,
    SqlMerchantRepository,
    SqlPaymentRepository,
)
from caspi.interfaces.schemas.payments import PaymentResponse

router = APIRouter(prefix="/api/dev", tags=["dev"])


class CreateDevPaymentBody(BaseModel):
    amount: Decimal
    date: date
    description: str


@router.post("/payments", response_model=PaymentResponse)
async def create_dev_payment(body: CreateDevPaymentBody, db: AsyncSession = Depends(get_db)):
    payment_repo = SqlPaymentRepository(db)
    import_batch_repo = SqlImportBatchRepository(db)
    merchant_repo = SqlMerchantRepository(db)

    accounts = [
        {
            "accountNumber": "dev",
            "txns": [
                {
                    "identifier": f"dev-{uuid4()}",
                    "chargedAmount": str(-body.amount),
                    "date": f"{body.date.isoformat()}T00:00:00",
                    "description": body.description,
                }
            ],
        }
    ]

    result = await import_isracard_accounts(
        accounts,
        payment_repo=payment_repo,
        import_batch_repo=import_batch_repo,
        merchant_repo=merchant_repo,
    )
    await db.commit()

    payments = await payment_repo.find_by_import(result.import_id)
    if not payments:
        raise HTTPException(status_code=500, detail="dev payment was not persisted")
    payment = payments[0]

    mrow = await db.get(MerchantModel, payment.merchant_id.value)
    alias = mrow.alias if mrow else None
    merchant_tag_map = await merchant_repo.load_tag_ids_by_merchant()
    mt = merchant_tag_map.get(payment.merchant_id.value, [])

    return domain_payment_to_response(payment, merchant_alias=alias, merchant_tag_ids=mt)
