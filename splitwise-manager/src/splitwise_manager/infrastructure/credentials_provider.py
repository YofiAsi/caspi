from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Awaitable, Callable

from splitwise_manager.domain.repositories.credentials import StoredCredentials
from splitwise_manager.infrastructure.splitwise_client import SplitwiseClient
from splitwise_manager.settings import settings


@dataclass
class ResolvedCreds:
    source: str  # "env" or "db"
    consumer_key: str
    consumer_secret: str
    api_key: str
    splitwise_user_id: int | None
    last_validated_at: datetime | None


CredsLoader = Callable[[], Awaitable[StoredCredentials | None]]


async def resolve_creds(db_load: CredsLoader) -> ResolvedCreds | None:
    """Prefer env vars; fall back to DB. Returns None if neither path has creds."""
    if settings.env_creds_present:
        return ResolvedCreds(
            source="env",
            consumer_key=settings.sw_consumer_key,
            consumer_secret=settings.sw_consumer_secret,
            api_key=settings.sw_api_key,
            splitwise_user_id=None,
            last_validated_at=None,
        )
    stored = await db_load()
    if stored is None:
        return None
    return ResolvedCreds(
        source="db",
        consumer_key=stored.consumer_key,
        consumer_secret=stored.consumer_secret,
        api_key=stored.api_key,
        splitwise_user_id=stored.splitwise_user_id,
        last_validated_at=stored.last_validated_at,
    )


def client_for(resolved: ResolvedCreds) -> SplitwiseClient:
    return SplitwiseClient(
        consumer_key=resolved.consumer_key,
        consumer_secret=resolved.consumer_secret,
        api_key=resolved.api_key,
    )
