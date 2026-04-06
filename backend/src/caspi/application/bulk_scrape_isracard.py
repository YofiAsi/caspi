import json
from dataclasses import dataclass
from datetime import date
from typing import AsyncGenerator

import httpx
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from caspi.application.scrape_isracard import import_isracard_accounts
from caspi.infrastructure.database import async_session as default_session_factory
from caspi.infrastructure.repositories import (
    SqlImportBatchRepository,
    SqlMerchantRepository,
    SqlPaymentRepository,
)


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


async def _iter_sse_json_events(response: httpx.Response) -> AsyncGenerator[dict, None]:
    async for line in response.aiter_lines():
        if not line or not line.startswith("data: "):
            continue
        raw = line[6:].strip()
        if not raw:
            continue
        yield json.loads(raw)


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
        session_factory: async_sessionmaker[AsyncSession] | None = None,
    ):
        self._scraper_url = scraper_url.rstrip("/")
        self._session_factory = session_factory or default_session_factory

    async def execute_stream(
        self, request: BulkScrapeIsracardRequest
    ) -> AsyncGenerator[dict, None]:
        end = request.end_date or date.today()
        total_months = count_bulk_sync_months(request.start_date, request.end_date)

        yield {"type": "start", "total": total_months}

        body: dict = {
            "id": request.id,
            "card6Digits": request.card6_digits,
            "password": request.password,
            "startDate": request.start_date.isoformat(),
            "endDate": end.isoformat(),
        }

        stream_url = f"{self._scraper_url}/scrape/isracard/stream"
        timeout = httpx.Timeout(connect=120.0, read=None, write=120.0, pool=120.0)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("POST", stream_url, json=body) as response:
                    if response.status_code != 200:
                        err_body = (await response.aread()).decode(errors="replace")
                        detail_msg = err_body
                        try:
                            err_json = json.loads(err_body)
                            detail_msg = str(
                                err_json.get("message") or err_json.get("error") or err_body
                            )
                        except (json.JSONDecodeError, TypeError):
                            pass
                        yield {
                            "type": "month_error",
                            "month": "",
                            "error": detail_msg or f"HTTP {response.status_code}",
                            "error_code": "",
                        }
                        yield {
                            "type": "done",
                            "total_payments": 0,
                            "months_scraped": 0,
                            "months_failed": 1,
                        }
                        return

                    saw_complete = False
                    async for event in _iter_sse_json_events(response):
                        et = event.get("type")
                        if et == "complete":
                            saw_complete = True
                            if event.get("success"):
                                accounts = event.get("accounts") or []
                                try:
                                    async with self._session_factory() as session:
                                        result = await import_isracard_accounts(
                                            accounts,
                                            payment_repo=SqlPaymentRepository(session),
                                            import_batch_repo=SqlImportBatchRepository(session),
                                            merchant_repo=SqlMerchantRepository(session),
                                        )
                                        await session.commit()
                                except Exception as e:
                                    yield {
                                        "type": "month_error",
                                        "month": "",
                                        "error": str(e),
                                        "error_code": "",
                                    }
                                    yield {
                                        "type": "done",
                                        "total_payments": 0,
                                        "months_scraped": 0,
                                        "months_failed": 1,
                                    }
                                    break
                                yield {
                                    "type": "done",
                                    "total_payments": result.payment_count,
                                    "months_scraped": total_months,
                                    "months_failed": 0,
                                }
                            else:
                                err_type = event.get("errorType")
                                yield {
                                    "type": "month_error",
                                    "month": "",
                                    "error": str(event.get("errorMessage") or "Scrape failed"),
                                    "error_code": str(err_type) if err_type is not None else "",
                                }
                                yield {
                                    "type": "done",
                                    "total_payments": 0,
                                    "months_scraped": 0,
                                    "months_failed": 1,
                                }
                            break

                        if et in (
                            "progress",
                            "month_done",
                            "rate_limit",
                            "session_recycle",
                        ):
                            yield event

                    if not saw_complete:
                        yield {
                            "type": "month_error",
                            "month": "",
                            "error": "Scraper stream ended without a result",
                            "error_code": "",
                        }
                        yield {
                            "type": "done",
                            "total_payments": 0,
                            "months_scraped": 0,
                            "months_failed": 1,
                        }

        except httpx.RequestError as e:
            yield {"type": "month_error", "month": "", "error": str(e), "error_code": ""}
            yield {
                "type": "done",
                "total_payments": 0,
                "months_scraped": 0,
                "months_failed": 1,
            }
        except json.JSONDecodeError as e:
            yield {
                "type": "month_error",
                "month": "",
                "error": f"Invalid scraper event: {e}",
                "error_code": "",
            }
            yield {
                "type": "done",
                "total_payments": 0,
                "months_scraped": 0,
                "months_failed": 1,
            }
