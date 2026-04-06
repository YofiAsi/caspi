import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

from caspi.application.scrape_isracard import ScrapeIsracardRequest, ScrapeIsracardUseCase
from caspi.infrastructure.database import async_session
from caspi.infrastructure.repositories import (
    SqlImportBatchRepository,
    SqlMerchantRepository,
    SqlPaymentRepository,
)
from caspi.settings import settings

logger = logging.getLogger("caspi.auto_scrape")

_last_success: datetime | None = None
_last_error: str | None = None
_consecutive_failures: int = 0


async def _run_once() -> None:
    global _last_success, _last_error, _consecutive_failures

    start_date = date.today() - timedelta(days=settings.auto_scrape_lookback_days)

    async with async_session() as db:
        use_case = ScrapeIsracardUseCase(
            scraper_url=settings.scraper_url,
            payment_repo=SqlPaymentRepository(db),
            import_batch_repo=SqlImportBatchRepository(db),
            merchant_repo=SqlMerchantRepository(db),
        )
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

    _last_success = datetime.now(timezone.utc)
    _last_error = None
    _consecutive_failures = 0
    logger.info(
        "Auto-scrape complete: %d new payments (lookback=%d days)",
        result.payment_count,
        settings.auto_scrape_lookback_days,
    )


async def run_auto_scrape_loop() -> None:
    global _last_error, _consecutive_failures

    interval = settings.auto_scrape_interval_minutes * 60
    logger.info(
        "Auto-scrape started: every %d min, lookback %d days",
        settings.auto_scrape_interval_minutes,
        settings.auto_scrape_lookback_days,
    )

    # Let scraper and DB services finish starting up
    await asyncio.sleep(30)

    while True:
        try:
            await _run_once()
        except asyncio.CancelledError:
            logger.info("Auto-scrape loop cancelled")
            raise
        except Exception as exc:
            _consecutive_failures += 1
            _last_error = str(exc)
            logger.exception(
                "Auto-scrape failed (consecutive failures: %d)",
                _consecutive_failures,
            )

        await asyncio.sleep(interval)


def get_auto_scrape_status() -> dict:
    return {
        "enabled": settings.auto_scrape_enabled,
        "interval_minutes": settings.auto_scrape_interval_minutes,
        "lookback_days": settings.auto_scrape_lookback_days,
        "last_success": _last_success.isoformat() if _last_success else None,
        "last_error": _last_error,
        "consecutive_failures": _consecutive_failures,
    }
