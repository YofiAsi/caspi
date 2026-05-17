from datetime import datetime, timezone

from splitwise_manager.tasks.backoff import SCHEDULE_SECONDS, next_attempt_at


def test_first_attempt_uses_first_step():
    before = datetime.now(timezone.utc)
    nxt = next_attempt_at(1)
    delta = (nxt - before).total_seconds()
    assert SCHEDULE_SECONDS[0] - 1 <= delta <= SCHEDULE_SECONDS[0] + 2


def test_clamps_to_last_step():
    before = datetime.now(timezone.utc)
    nxt = next_attempt_at(999)
    delta = (nxt - before).total_seconds()
    assert SCHEDULE_SECONDS[-1] - 1 <= delta <= SCHEDULE_SECONDS[-1] + 2


def test_zero_attempts_treated_as_first():
    before = datetime.now(timezone.utc)
    nxt = next_attempt_at(0)
    delta = (nxt - before).total_seconds()
    assert SCHEDULE_SECONDS[0] - 1 <= delta <= SCHEDULE_SECONDS[0] + 2
