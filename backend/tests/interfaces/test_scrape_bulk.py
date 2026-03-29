from unittest.mock import patch

from fastapi.testclient import TestClient

from caspi.interfaces.app import app
from caspi.settings import settings

client = TestClient(app)


def test_bulk_full_range_rejects_mid_month_start():
    r = client.post("/api/scrape/isracard/bulk?start_date=2025-01-15")
    assert r.status_code == 422
    assert "first day" in r.json()["detail"].lower()


def test_bulk_single_month_rejects_bad_window():
    r = client.post(
        "/api/scrape/isracard/bulk?start_date=2025-01-01&end_date=2025-01-15",
    )
    assert r.status_code == 422


def test_bulk_full_range_rejects_when_span_exceeds_cap():
    with patch.object(settings, "isracard_full_sync_max_months", 3):
        r = client.post("/api/scrape/isracard/bulk?start_date=2020-01-01")
    assert r.status_code == 422
    assert "ISRACARD_FULL_SYNC_MAX_MONTHS" in r.json()["detail"]
