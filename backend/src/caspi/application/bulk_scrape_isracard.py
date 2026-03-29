import asyncio
import calendar
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


async def _yield_cooldown(
    total_seconds: int,
    tick_seconds: int,
    month_str: str,
) -> AsyncGenerator[dict, None]:
    if total_seconds <= 0 or tick_seconds <= 0:
        return
    remaining = total_seconds
    while remaining > 0:
        step = min(tick_seconds, remaining)
        yield {"type": "cooldown", "seconds": remaining, "next_month": month_str}
        await asyncio.sleep(step)
        remaining -= step


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


def count_bulk_sync_months(start: date, end: date | None) -> int:
    effective_end = end if end is not None else date.today()
    return len(_monthly_starts(start, effective_end))


@dataclass
class BulkScrapeIsracardRequest:
    id: str
    card6_digits: str
    password: str
    start_date: date
    end_date: date | None = None


class BulkScrapeIsracardUseCase:
    def __init__(
        self,
        scraper_url: str,
        *,
        cooldown_min_seconds: int = 10,
        cooldown_initial_seconds: int = 45,
        cooldown_step_down_seconds: int = 8,
        cooldown_max_seconds: int = 180,
        cooldown_tick_seconds: int = 2,
        automation_retry_seconds: int = 120,
        cooldown_failure_bump_seconds: int = 25,
    ):
        self._scraper_url = scraper_url
        self._cooldown_min = max(0, cooldown_min_seconds)
        self._cooldown_initial = max(self._cooldown_min, cooldown_initial_seconds)
        self._cooldown_step_down = max(0, cooldown_step_down_seconds)
        self._cooldown_max = max(self._cooldown_initial, cooldown_max_seconds)
        self._cooldown_tick = max(1, cooldown_tick_seconds)
        self._automation_retry = max(0, automation_retry_seconds)
        self._failure_bump = max(0, cooldown_failure_bump_seconds)

    async def execute_stream(
        self, request: BulkScrapeIsracardRequest
    ) -> AsyncGenerator[dict, None]:
        end = request.end_date or date.today()
        months = _monthly_starts(request.start_date, end)
        total = len(months)

        yield {"type": "start", "total": total}

        total_payments = 0
        months_failed = 0
        gap_seconds = self._cooldown_initial

        for i, month_start in enumerate(months):
            month_str = month_start.strftime("%Y-%m")

            if i > 0:
                async for ev in _yield_cooldown(
                    gap_seconds, self._cooldown_tick, month_str
                ):
                    yield ev

            yield {"type": "progress", "current": i + 1, "total": total, "month": month_str}

            _, last_d = calendar.monthrange(month_start.year, month_start.month)
            month_end = date(month_start.year, month_start.month, last_d)

            for attempt in range(2):
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
                                end_date=month_end,
                            )
                        )
                        await session.commit()

                    total_payments += result.payment_count
                    gap_seconds = max(
                        self._cooldown_min,
                        gap_seconds - self._cooldown_step_down,
                    )
                    yield {
                        "type": "month_done",
                        "month": month_str,
                        "payment_count": result.payment_count,
                    }
                    break

                except httpx.HTTPStatusError as e:
                    error_code = ""
                    error_msg = str(e)
                    if e.response.status_code == 422:
                        try:
                            detail = e.response.json()
                            error_code = str(detail.get("error") or "")
                            error_msg = (
                                detail.get("message")
                                or detail.get("error")
                                or error_msg
                            )
                        except Exception:
                            pass
                    if (
                        attempt == 0
                        and e.response.status_code == 422
                        and error_code == "AUTOMATION_BLOCKED"
                    ):
                        gap_seconds = min(
                            self._cooldown_max,
                            gap_seconds + self._failure_bump,
                        )
                        async for ev in _yield_cooldown(
                            self._automation_retry, self._cooldown_tick, month_str
                        ):
                            yield ev
                        continue
                    months_failed += 1
                    err_event: dict = {
                        "type": "month_error",
                        "month": month_str,
                        "error": error_msg,
                    }
                    if error_code:
                        err_event["error_code"] = error_code
                    yield err_event
                    gap_seconds = min(
                        self._cooldown_max,
                        gap_seconds + self._failure_bump,
                    )
                    break

                except Exception as e:
                    months_failed += 1
                    yield {"type": "month_error", "month": month_str, "error": str(e)}
                    gap_seconds = min(
                        self._cooldown_max,
                        gap_seconds + self._failure_bump,
                    )
                    break

        yield {
            "type": "done",
            "total_payments": total_payments,
            "months_scraped": total - months_failed,
            "months_failed": months_failed,
        }
