from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from caspi.interfaces.app import app
from caspi.interfaces.routers import ai_settings as ai_mod


@pytest.fixture
def client():
    return TestClient(app)


def test_get_never_leaks_key(client, monkeypatch):
    async def fake_response(db):
        return ai_mod.AISettingsResponse(
            configured=True,
            source="db",
            provider="openai",
            model="gpt-4",
            api_base="https://api.openai.com",
            has_api_key=True,
        )

    monkeypatch.setattr(ai_mod, "_response", fake_response)
    r = client.get("/api/ai-settings")
    assert r.status_code == 200
    data = r.json()
    assert "api_key" not in data
    assert data["has_api_key"] is True


@pytest.mark.asyncio
async def test_omit_key_preserves(monkeypatch):
    existing_key = "keep-me"

    class FakeRepo:
        def __init__(self, _session):
            pass

        async def load(self):
            from caspi.application.ai_settings import StoredAISettings

            return StoredAISettings(
                provider="openai",
                model="gpt-4",
                api_base=None,
                api_key=existing_key,
            )

        async def save(self, stored):
            assert stored.api_key == existing_key

        async def delete(self):
            pass

    monkeypatch.setattr(ai_mod, "AISettingsRepo", FakeRepo)
    db = AsyncMock()
    body = ai_mod.AISettingsPutBody(provider="openai", model="gpt-4")
    await ai_mod.put_ai_settings(body, db)
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_put_stores_key(monkeypatch):
    saved = {}

    class FakeRepo:
        def __init__(self, _session):
            pass

        async def load(self):
            return None

        async def save(self, stored):
            saved["api_key"] = stored.api_key

        async def delete(self):
            pass

    monkeypatch.setattr(ai_mod, "AISettingsRepo", FakeRepo)
    db = AsyncMock()
    body = ai_mod.AISettingsPutBody(
        provider="openai",
        model="gpt-4",
        api_key="new-secret",
    )
    await ai_mod.put_ai_settings(body, db)
    assert saved["api_key"] == "new-secret"
