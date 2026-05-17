from datetime import datetime, timedelta, timezone

# Exponential backoff capped at 1h. Index = attempts before this retry.
SCHEDULE_SECONDS = [60, 300, 1500, 3600, 3600, 3600, 3600, 3600]


def next_attempt_at(attempts: int) -> datetime:
    idx = min(max(attempts - 1, 0), len(SCHEDULE_SECONDS) - 1)
    return datetime.now(timezone.utc) + timedelta(seconds=SCHEDULE_SECONDS[idx])
