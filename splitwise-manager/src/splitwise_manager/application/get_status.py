from __future__ import annotations

from dataclasses import dataclass

from splitwise_manager.domain.repositories.credentials import CredentialsRepository
from splitwise_manager.domain.repositories.outbox import OutboxRepository
from splitwise_manager.domain.value_objects.enums import OutboxStatus
from splitwise_manager.infrastructure.credentials_provider import resolve_creds


@dataclass
class StatusResult:
    connected: bool
    source: str | None
    splitwise_user_id: int | None
    last_validated_at_iso: str | None
    queued: int
    failed: int


async def get_status(
    *,
    creds_repo: CredentialsRepository,
    outbox_repo: OutboxRepository,
) -> StatusResult:
    resolved = await resolve_creds(creds_repo.load)
    queued = await outbox_repo.count_by_status(OutboxStatus.QUEUED)
    failed = await outbox_repo.count_by_status(OutboxStatus.FAILED)
    if resolved is None:
        return StatusResult(
            connected=False,
            source=None,
            splitwise_user_id=None,
            last_validated_at_iso=None,
            queued=queued,
            failed=failed,
        )
    return StatusResult(
        connected=True,
        source=resolved.source,
        splitwise_user_id=resolved.splitwise_user_id,
        last_validated_at_iso=resolved.last_validated_at.isoformat()
        if resolved.last_validated_at
        else None,
        queued=queued,
        failed=failed,
    )
