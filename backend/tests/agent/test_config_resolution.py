import os
from unittest.mock import AsyncMock, MagicMock

import pytest

from caspi.application.ai_settings import AIConfigError, AISettingsRepo, LLMConfig, StoredAISettings, resolve_llm_config
from caspi.settings import settings


@pytest.fixture(autouse=True)
def clear_env_ai(monkeypatch):
    monkeypatch.delenv("AI_MODEL", raising=False)
    monkeypatch.delenv("AI_API_BASE", raising=False)
    monkeypatch.delenv("AI_API_KEY", raising=False)
    settings.ai_model = None
    settings.ai_api_base = None
    settings.ai_api_key = None
    yield


@pytest.mark.asyncio
async def test_db_wins_over_env(monkeypatch):
    settings.ai_model = "env/model"
    settings.ai_api_base = "http://env"
    settings.ai_api_key = "env-key"

    db = AsyncMock()
    repo = AISettingsRepo(db)
    repo.load = AsyncMock(
        return_value=StoredAISettings(
            provider="openai",
            model="db/model",
            api_base="http://db",
            api_key="db-key",
        )
    )
    monkeypatch.setattr("caspi.application.ai_settings.AISettingsRepo", lambda _s: repo)

    cfg = await resolve_llm_config(db)
    assert cfg == LLMConfig(model="db/model", api_base="http://db", api_key="db-key", provider="openai")


@pytest.mark.asyncio
async def test_env_fallback_when_no_db_row(monkeypatch):
    settings.ai_model = "ollama/llama3.1"
    settings.ai_api_base = "http://localhost:11434"
    settings.ai_api_key = "dummy"

    db = AsyncMock()
    repo = AISettingsRepo(db)
    repo.load = AsyncMock(return_value=None)
    monkeypatch.setattr("caspi.application.ai_settings.AISettingsRepo", lambda _s: repo)

    cfg = await resolve_llm_config(db)
    assert cfg.model == "ollama/llama3.1"
    assert cfg.api_base == "http://localhost:11434"
    assert cfg.api_key == "dummy"


@pytest.mark.asyncio
async def test_not_configured_raises(monkeypatch):
    db = AsyncMock()
    repo = AISettingsRepo(db)
    repo.load = AsyncMock(return_value=None)
    monkeypatch.setattr("caspi.application.ai_settings.AISettingsRepo", lambda _s: repo)

    with pytest.raises(AIConfigError):
        await resolve_llm_config(db)
