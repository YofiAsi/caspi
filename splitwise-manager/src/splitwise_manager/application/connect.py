from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from splitwise_manager.domain.repositories.credentials import (
    CredentialsRepository,
    StoredCredentials,
)
from splitwise_manager.infrastructure.splitwise_client import SplitwiseAPIError, SplitwiseClient
from splitwise_manager.settings import settings


@dataclass
class ConnectRequest:
    consumer_key: str | None = None
    consumer_secret: str | None = None
    api_key: str | None = None


@dataclass
class ConnectResult:
    source: str  # "env" or "db"
    splitwise_user_id: int


async def connect(
    request: ConnectRequest,
    *,
    creds_repo: CredentialsRepository,
    client_factory=SplitwiseClient,
) -> ConnectResult:
    if settings.env_creds_present:
        client = client_factory(
            settings.sw_consumer_key, settings.sw_consumer_secret, settings.sw_api_key
        )
        user_id = await client.validate()
        return ConnectResult(source="env", splitwise_user_id=user_id)

    if not (request.consumer_key and request.consumer_secret and request.api_key):
        raise SplitwiseAPIError(
            "no env credentials; consumer_key, consumer_secret and api_key are required"
        )

    client = client_factory(request.consumer_key, request.consumer_secret, request.api_key)
    user_id = await client.validate()

    await creds_repo.save(
        StoredCredentials(
            consumer_key=request.consumer_key,
            consumer_secret=request.consumer_secret,
            api_key=request.api_key,
            splitwise_user_id=user_id,
            last_validated_at=datetime.now(timezone.utc),
        )
    )
    return ConnectResult(source="db", splitwise_user_id=user_id)
