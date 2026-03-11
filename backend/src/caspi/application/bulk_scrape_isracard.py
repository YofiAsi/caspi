import asyncio
from dataclasses import dataclass
from datetime import date
from typing import AsyncGenerator

import httpx

from caspi.application.scrape_isracard import ScrapeIsracardRequest, ScrapeIsracardUseCase
from caspi.infrastructure.database import async_session
from caspi.infrastructure.repositories import (
    SqlImportBatchRepository,
    SqlPaymentRepository,
    SqlSharingRuleRepository,
)

_COOLDOWN_SECONDS = 60
_COOLDOWN_TICK = 5


def _monthly_starts(start: date, end: date) -> list[date]:
    result = []
    current = date(start.year, start.month, 1)
    end_month = date(end.year, end.month, 1)
    while current <= end_month:
        result.append(current)
        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)
    return result


@dataclass
class BulkScrapeIsracardRequest:
    id: str
    card6_digits: str
    password: str
    start_date: date
    end_date: date | None = None


class BulkScrapeIsracardUseCase:
    def __init__(self, scraper_url: str):
        self._scraper_url = scraper_url

    async def execute_stream(
        self, request: BulkScrapeIsracardRequest
    ) -> AsyncGenerator[dict, None]:
        end = request.end_date or date.today()
        months = _monthly_starts(request.start_date, end)
        total = len(months)

        yield {"type": "start", "total": total}

        total_payments = 0
        months_failed = 0

        for i, month_start in enumerate(months):
            month_str = month_start.strftime("%Y-%m")

            if i > 0:
                for remaining in range(_COOLDOWN_SECONDS, 0, -_COOLDOWN_TICK):
                    yield {"type": "cooldown", "seconds": remaining, "next_month": month_str}
                    await asyncio.sleep(_COOLDOWN_TICK)

            yield {"type": "progress", "current": i + 1, "total": total, "month": month_str}

            try:
                async with async_session() as session:
                    use_case = ScrapeIsracardUseCase(
                        scraper_url=self._scraper_url,
                        payment_repo=SqlPaymentRepository(session),
                        import_batch_repo=SqlImportBatchRepository(session),
                        sharing_rule_repo=SqlSharingRuleRepository(session),
                    )
                    result = await use_case.execute(
                        ScrapeIsracardRequest(
                            id=request.id,
                            card6_digits=request.card6_digits,
                            password=request.password,
                            start_date=month_start,
                        )
                    )
                    await session.commit()

                total_payments += result.payment_count
                yield {"type": "month_done", "month": month_str, "payment_count": result.payment_count}

            except httpx.HTTPStatusError as e:
                months_failed += 1
                try:
                    detail = e.response.json()
                    error_msg = detail.get("message") or detail.get("error") or str(e)
                except Exception:
                    error_msg = str(e)
                yield {"type": "month_error", "month": month_str, "error": error_msg}
            except Exception as e:
                months_failed += 1
                yield {"type": "month_error", "month": month_str, "error": str(e)}

        yield {
            "type": "done",
            "total_payments": total_payments,
            "months_scraped": total - months_failed,
            "months_failed": months_failed,
        }
