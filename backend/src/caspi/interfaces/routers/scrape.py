from datetime import date
from decimal import Decimal
from uuid import UUID

import json

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.bulk_scrape_isracard import BulkScrapeIsracardRequest, BulkScrapeIsracardUseCase
from caspi.application.scrape_isracard import ScrapeIsracardRequest, ScrapeIsracardUseCase
from caspi.domain.value_objects import ImportId
from caspi.infrastructure.database import get_db
from caspi.infrastructure.repositories import SqlImportBatchRepository, SqlPaymentRepository, SqlSharingRuleRepository
from caspi.settings import settings

router = APIRouter(prefix="/api/scrape", tags=["scrape"])


class ScrapeIsracardResponse(BaseModel):
    import_id: str
    payment_count: int
    imported_at: str


class PaymentItem(BaseModel):
    payment_id: str
    date: date
    description: str
    amount: Decimal
    currency: str
    effective_amount: Decimal
    merchant: str | None
    payment_type: str
    extra: dict


@router.post("/isracard", response_model=ScrapeIsracardResponse)
async def scrape_isracard(start_date: date | None = None, db: AsyncSession = Depends(get_db)):
    use_case = ScrapeIsracardUseCase(
        scraper_url=settings.scraper_url,
        payment_repo=SqlPaymentRepository(db),
        import_batch_repo=SqlImportBatchRepository(db),
        sharing_rule_repo=SqlSharingRuleRepository(db),
    )
    try:
        result = await use_case.execute(
            ScrapeIsracardRequest(
                id=settings.isracard_id,
                card6_digits=settings.isracard_card6_digits,
                password=settings.isracard_password,
                start_date=start_date,
            )
        )
        await db.commit()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Scraper unreachable: {e}")

    return ScrapeIsracardResponse(
        import_id=str(result.import_id.value),
        payment_count=result.payment_count,
        imported_at=result.imported_at.isoformat(),
    )


@router.post("/isracard/bulk")
async def bulk_scrape_isracard(start_date: date, end_date: date | None = None):
    request = BulkScrapeIsracardRequest(
        id=settings.isracard_id,
        card6_digits=settings.isracard_card6_digits,
        password=settings.isracard_password,
        start_date=start_date,
        end_date=end_date,
    )
    use_case = BulkScrapeIsracardUseCase(scraper_url=settings.scraper_url)

    async def generate():
        async for event in use_case.execute_stream(request):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/isracard/{import_id}", response_model=list[PaymentItem])
async def get_scrape_results(import_id: str, db: AsyncSession = Depends(get_db)):
    try:
        iid = ImportId(UUID(import_id))
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid import_id format")

    payments = await SqlPaymentRepository(db).find_by_import(iid)
    return [
        PaymentItem(
            payment_id=str(p.payment_id.value),
            date=p.date,
            description=p.description,
            amount=p.amount.amount,
            currency=p.amount.currency,
            effective_amount=p.effective_amount.amount,
            merchant=p.merchant,
            payment_type=p.payment_type.value,
            extra=p.extra,
        )
        for p in payments
    ]
