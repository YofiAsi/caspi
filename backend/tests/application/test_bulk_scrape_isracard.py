from datetime import date

from caspi.application.bulk_scrape_isracard import count_bulk_sync_months


def test_count_bulk_sync_months_single_month():
    assert count_bulk_sync_months(date(2025, 1, 1), date(2025, 1, 31)) == 1


def test_count_bulk_sync_months_three_months():
    assert count_bulk_sync_months(date(2025, 1, 1), date(2025, 3, 31)) == 3


def test_count_bulk_sync_months_no_end_covers_current_month():
    first_this_month = date.today().replace(day=1)
    n = count_bulk_sync_months(first_this_month, None)
    assert n >= 1
