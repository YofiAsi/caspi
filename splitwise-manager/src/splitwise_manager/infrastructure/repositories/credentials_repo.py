from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from splitwise_manager.domain.repositories.credentials import (
    CredentialsRepository,
    StoredCredentials,
)
from splitwise_manager.infrastructure.crypto import decrypt, encrypt
from splitwise_manager.infrastructure.models import CredentialsModel


class SqlCredentialsRepository(CredentialsRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def _row(self) -> CredentialsModel | None:
        result = await self._session.execute(
            select(CredentialsModel).where(CredentialsModel.singleton_key == "default")
        )
        return result.scalar_one_or_none()

    async def load(self) -> StoredCredentials | None:
        row = await self._row()
        if row is None:
            return None
        return StoredCredentials(
            consumer_key=decrypt(row.consumer_key_enc),
            consumer_secret=decrypt(row.consumer_secret_enc),
            api_key=decrypt(row.api_key_enc),
            splitwise_user_id=row.splitwise_user_id,
            last_validated_at=row.last_validated_at,
        )

    async def save(self, creds: StoredCredentials) -> None:
        row = await self._row()
        now = datetime.now(timezone.utc)
        if row is None:
            row = CredentialsModel(
                singleton_key="default",
                consumer_key_enc=encrypt(creds.consumer_key),
                consumer_secret_enc=encrypt(creds.consumer_secret),
                api_key_enc=encrypt(creds.api_key),
                splitwise_user_id=creds.splitwise_user_id,
                last_validated_at=creds.last_validated_at or now,
            )
            self._session.add(row)
        else:
            row.consumer_key_enc = encrypt(creds.consumer_key)
            row.consumer_secret_enc = encrypt(creds.consumer_secret)
            row.api_key_enc = encrypt(creds.api_key)
            row.splitwise_user_id = creds.splitwise_user_id
            row.last_validated_at = creds.last_validated_at or now
            row.updated_at = now
        await self._session.flush()

    async def delete(self) -> None:
        await self._session.execute(
            delete(CredentialsModel).where(CredentialsModel.singleton_key == "default")
        )
