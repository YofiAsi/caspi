import calendar
from datetime import date
from decimal import Decimal
from uuid import UUID

import json

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.bulk_scrape_isracard import (
    BulkScrapeIsracardRequest,
    BulkScrapeIsracardUseCase,
    count_bulk_sync_months,
)
from caspi.application.scrape_isracard import ScrapeIsracardRequest, ScrapeIsracardUseCase
from caspi.domain.value_objects import ImportId
from caspi.infrastructure.database import get_db
from caspi.infrastructure.repositories import SqlImportBatchRepository, SqlPaymentRepository, SqlSharingRuleRepository
from caspi.settings import settings

router = APIRouter(prefix="/api/scrape", tags=["scrape"])


def _is_single_calendar_month_window(start: date, end: date) -> bool:
    if start.day != 1:
        return False
    if start.year != end.year or start.month != end.month:
        return False
    _, last_day = calendar.monthrange(end.year, end.month)
    return end.day == last_day


def _is_first_day_of_month(d: date) -> bool:
    return d.day == 1


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
                end_date=date.today(),
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
    """Month sync: pass start_date (first of month) and end_date (last of same month).

    Full range sync: pass start_date only (must be the first day of a month). Each calendar
    month from that month through the current month is scraped (see BulkScrapeIsracardUseCase).
    """
    if end_date is not None:
        if not _is_single_calendar_month_window(start_date, end_date):
            raise HTTPException(
                status_code=422,
                detail="start_date must be the first day of a month and end_date the last day of that month",
            )
    else:
        if not _is_first_day_of_month(start_date):
            raise HTTPException(
                status_code=422,
                detail="full range sync requires start_date on the first day of a month",
            )
        max_months = settings.isracard_full_sync_max_months
        if max_months > 0:
            span = count_bulk_sync_months(start_date, None)
            if span > max_months:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"range is {span} months; exceeds ISRACARD_FULL_SYNC_MAX_MONTHS ({max_months}). "
                        "Use a later start_date or raise the limit."
                    ),
                )
    request = BulkScrapeIsracardRequest(
        id=settings.isracard_id,
        card6_digits=settings.isracard_card6_digits,
        password=settings.isracard_password,
        start_date=start_date,
        end_date=end_date,
    )
    use_case = BulkScrapeIsracardUseCase(
        scraper_url=settings.scraper_url,
        cooldown_min_seconds=settings.isracard_bulk_cooldown_min_seconds,
        cooldown_initial_seconds=settings.isracard_bulk_cooldown_initial_seconds,
        cooldown_step_down_seconds=settings.isracard_bulk_cooldown_step_down_seconds,
        cooldown_max_seconds=settings.isracard_bulk_cooldown_max_seconds,
        cooldown_tick_seconds=settings.isracard_bulk_cooldown_tick_seconds,
        automation_retry_seconds=settings.isracard_bulk_automation_retry_seconds,
        cooldown_failure_bump_seconds=settings.isracard_bulk_cooldown_failure_bump_seconds,
    )

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
