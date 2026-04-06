from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from caspi.application.bulk_scrape_isracard import BulkScrapeIsracardRequest, BulkScrapeIsracardUseCase


class _FakeStreamResponse:
    def __init__(self, lines: list[str], status_code: int = 200):
        self.status_code = status_code
        self._lines = lines

    async def aiter_lines(self):
        for line in self._lines:
            yield line

    async def aread(self):
        return b'{"error":"bad"}'


class _StreamCtx:
    def __init__(self, resp: _FakeStreamResponse):
        self._resp = resp

    async def __aenter__(self):
        return self._resp

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _ClientCtx:
    def __init__(self, resp: _FakeStreamResponse):
        self._resp = resp

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def stream(self, method, url, json=None):
        return _StreamCtx(self._resp)


class _SessionCM:
    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.asyncio
async def test_execute_stream_forwards_progress_and_imports_on_complete():
    lines = [
        'data: {"type":"progress","current":1,"total":1,"month":"2025-01"}',
        'data: {"type":"complete","success":true,"accounts":[]}',
    ]
    fake_resp = _FakeStreamResponse(lines)
    fake_client = _ClientCtx(fake_resp)
    mock_async_client = MagicMock(return_value=fake_client)

    mock_session = MagicMock()
    mock_session.commit = AsyncMock()

    def session_factory():
        return _SessionCM(mock_session)

    with patch("caspi.application.bulk_scrape_isracard.httpx.AsyncClient", mock_async_client):
        with patch(
            "caspi.application.bulk_scrape_isracard.import_isracard_accounts",
            new_callable=AsyncMock,
        ) as imp:
            imp.return_value = MagicMock(payment_count=2)
            uc = BulkScrapeIsracardUseCase(
                "http://scraper:3001",
                session_factory=session_factory,
            )
            req = BulkScrapeIsracardRequest(
                id="u",
                card6_digits="123456",
                password="secret",
                start_date=date(2025, 1, 1),
                end_date=date(2025, 1, 31),
            )
            events = [e async for e in uc.execute_stream(req)]

    assert events[0] == {"type": "start", "total": 1}
    assert events[1]["type"] == "progress"
    assert events[2] == {
        "type": "done",
        "total_payments": 2,
        "months_scraped": 1,
        "months_failed": 0,
    }
    imp.assert_awaited_once()
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_execute_stream_non_200_yields_error_done():
    fake_resp = _FakeStreamResponse([], status_code=400)
    fake_client = _ClientCtx(fake_resp)
    mock_async_client = MagicMock(return_value=fake_client)

    with patch("caspi.application.bulk_scrape_isracard.httpx.AsyncClient", mock_async_client):
        uc = BulkScrapeIsracardUseCase("http://scraper:3001")
        req = BulkScrapeIsracardRequest(
            id="u",
            card6_digits="123456",
            password="secret",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 31),
        )
        events = [e async for e in uc.execute_stream(req)]

    assert events[0]["type"] == "start"
    assert events[1]["type"] == "month_error"
    assert events[2]["type"] == "done"
    assert events[2]["months_failed"] == 1


@pytest.mark.asyncio
async def test_execute_stream_complete_failure():
    lines = [
        'data: {"type":"complete","success":false,"errorType":"RateLimited","errorMessage":"slow down"}',
    ]
    fake_resp = _FakeStreamResponse(lines)
    fake_client = _ClientCtx(fake_resp)
    mock_async_client = MagicMock(return_value=fake_client)

    with patch("caspi.application.bulk_scrape_isracard.httpx.AsyncClient", mock_async_client):
        uc = BulkScrapeIsracardUseCase("http://scraper:3001")
        req = BulkScrapeIsracardRequest(
            id="u",
            card6_digits="123456",
            password="secret",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 31),
        )
        events = [e async for e in uc.execute_stream(req)]

    assert any(e.get("type") == "month_error" for e in events)
    assert events[-1]["type"] == "done"
    assert events[-1]["months_failed"] == 1
