from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.infrastructure.crypto import decrypt, encrypt
from caspi.infrastructure.models import AISettingsModel
from caspi.settings import settings


class AIConfigError(Exception):
    pass


@dataclass(frozen=True)
class LLMConfig:
    model: str
    api_base: str | None
    api_key: str | None
    provider: str | None = None


@dataclass
class StoredAISettings:
    provider: str | None
    model: str | None
    api_base: str | None
    api_key: str | None


class AISettingsRepo:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def _row(self) -> AISettingsModel | None:
        result = await self._session.execute(
            select(AISettingsModel).where(AISettingsModel.singleton_key == "default")
        )
        return result.scalar_one_or_none()

    async def load(self) -> StoredAISettings | None:
        row = await self._row()
        if row is None:
            return None
        api_key = decrypt(row.api_key_enc) if row.api_key_enc else None
        return StoredAISettings(
            provider=row.provider,
            model=row.model,
            api_base=row.api_base,
            api_key=api_key,
        )

    async def save(self, stored: StoredAISettings) -> None:
        row = await self._row()
        now = datetime.now(timezone.utc)
        api_key_enc = encrypt(stored.api_key) if stored.api_key else None
        if row is None:
            row = AISettingsModel(
                singleton_key="default",
                provider=stored.provider,
                model=stored.model,
                api_base=stored.api_base,
                api_key_enc=api_key_enc,
            )
            self._session.add(row)
        else:
            row.provider = stored.provider
            row.model = stored.model
            row.api_base = stored.api_base
            if stored.api_key is not None:
                row.api_key_enc = api_key_enc
            row.updated_at = now
        await self._session.flush()

    async def delete(self) -> None:
        await self._session.execute(
            delete(AISettingsModel).where(AISettingsModel.singleton_key == "default")
        )


async def resolve_llm_config(db: AsyncSession) -> LLMConfig:
    repo = AISettingsRepo(db)
    stored = await repo.load()
    if stored and stored.model:
        return LLMConfig(
            model=stored.model,
            api_base=stored.api_base,
            api_key=stored.api_key,
            provider=stored.provider,
        )
    if settings.ai_model:
        return LLMConfig(
            model=settings.ai_model,
            api_base=settings.ai_api_base,
            api_key=settings.ai_api_key,
            provider=None,
        )
    raise AIConfigError("AI provider not configured")
