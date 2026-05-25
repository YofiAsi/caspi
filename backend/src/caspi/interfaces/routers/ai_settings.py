from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.ai_settings import AISettingsRepo, StoredAISettings
from caspi.infrastructure.database import get_db
from caspi.settings import settings

router = APIRouter(prefix="/api/ai-settings", tags=["ai-settings"])


class AISettingsResponse(BaseModel):
    configured: bool
    source: str | None
    provider: str | None
    model: str | None
    api_base: str | None
    has_api_key: bool


class AISettingsPutBody(BaseModel):
    provider: str | None = None
    model: str | None = None
    api_base: str | None = None
    api_key: str | None = None
    clear_api_key: bool = False


async def _response(db: AsyncSession) -> AISettingsResponse:
    repo = AISettingsRepo(db)
    stored = await repo.load()
    if stored and stored.model:
        return AISettingsResponse(
            configured=True,
            source="db",
            provider=stored.provider,
            model=stored.model,
            api_base=stored.api_base,
            has_api_key=bool(stored.api_key),
        )
    if settings.ai_model:
        return AISettingsResponse(
            configured=True,
            source="env",
            provider=None,
            model=settings.ai_model,
            api_base=settings.ai_api_base,
            has_api_key=bool(settings.ai_api_key),
        )
    return AISettingsResponse(
        configured=False,
        source=None,
        provider=None,
        model=None,
        api_base=None,
        has_api_key=False,
    )


@router.get("", response_model=AISettingsResponse)
async def get_ai_settings(db: AsyncSession = Depends(get_db)) -> AISettingsResponse:
    return await _response(db)


@router.put("", response_model=AISettingsResponse)
async def put_ai_settings(
    body: AISettingsPutBody,
    db: AsyncSession = Depends(get_db),
) -> AISettingsResponse:
    repo = AISettingsRepo(db)
    existing = await repo.load()
    api_key = existing.api_key if existing else None
    if body.clear_api_key:
        api_key = None
    elif body.api_key is not None and body.api_key.strip():
        api_key = body.api_key.strip()

    await repo.save(
        StoredAISettings(
            provider=body.provider,
            model=body.model,
            api_base=body.api_base,
            api_key=api_key,
        )
    )
    await db.commit()
    return await _response(db)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ai_settings(db: AsyncSession = Depends(get_db)) -> None:
    repo = AISettingsRepo(db)
    await repo.delete()
    await db.commit()
