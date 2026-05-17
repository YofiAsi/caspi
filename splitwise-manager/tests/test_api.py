from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from splitwise_manager.api import routes as routes_mod
from splitwise_manager.domain.entities.merchant_share_rule import MerchantShareRule
from splitwise_manager.domain.entities.splitwise_outbox_entry import OutboxEntry
from splitwise_manager.domain.repositories.credentials import StoredCredentials
from splitwise_manager.domain.value_objects.enums import OutboxOperation, OutboxStatus, SplitMethod
from splitwise_manager.infrastructure.database import get_db
from splitwise_manager.main import app
from tests.fakes import (
    FakeCredentialsRepository,
    FakeLinkRepository,
    FakeOutboxRepository,
    FakeRuleRepository,
)


@pytest.fixture
def fakes(monkeypatch):
    creds = FakeCredentialsRepository(
        StoredCredentials(
            consumer_key="k",
            consumer_secret="s",
            api_key="a",
            splitwise_user_id=1234,
            last_validated_at=datetime.now(timezone.utc),
        )
    )
    links = FakeLinkRepository()
    outbox = FakeOutboxRepository()
    rules = FakeRuleRepository()

    monkeypatch.setattr(routes_mod, "SqlCredentialsRepository", lambda _s: creds)
    monkeypatch.setattr(routes_mod, "SqlLinkRepository", lambda _s: links)
    monkeypatch.setattr(routes_mod, "SqlOutboxRepository", lambda _s: outbox)
    monkeypatch.setattr(routes_mod, "SqlMerchantRuleRepository", lambda _s: rules)
    monkeypatch.setattr(routes_mod, "_dispatch_push", lambda _id: None)
    monkeypatch.setattr(routes_mod, "_dispatch_delete", lambda _id: None)

    class _NoOpSession:
        async def commit(self) -> None:
            return None

    async def _override():
        yield _NoOpSession()

    app.dependency_overrides[get_db] = _override
    try:
        yield {"creds": creds, "links": links, "outbox": outbox, "rules": rules}
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def client(fakes):
    return TestClient(app)


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200


def test_status(client):
    r = client.get("/status")
    assert r.status_code == 200
    body = r.json()
    assert body["connected"] is True
    assert body["splitwise_user_id"] == 1234


def test_share_endpoint_returns_share(client, fakes):
    payment_id = str(uuid4())
    r = client.post(
        "/share",
        json={
            "payment_id": payment_id,
            "amount": "90.00",
            "currency": "ILS",
            "group_id": 1,
            "split_method": "equal",
            "split_params": {"member_ids": [1, 2, 1234]},
            "description": "hi",
            "date": "2026-05-17",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert Decimal(body["my_share_amount"]) == Decimal("30.00")
    assert body["my_share_currency"] == "ILS"
    assert await_count(fakes["outbox"], OutboxStatus.QUEUED) == 1


def test_rules_crud(client, fakes):
    mid = str(uuid4())
    # initial GET → 404
    r = client.get(f"/rules/{mid}")
    assert r.status_code == 404

    r = client.put(
        f"/rules/{mid}",
        json={
            "enabled": True,
            "splitwise_group_id": 7,
            "split_method": "equal",
            "split_params": {"member_ids": [1, 2]},
            "currency": "ILS",
        },
    )
    assert r.status_code == 200
    assert r.json()["enabled"] is True

    r = client.get(f"/rules/{mid}")
    assert r.status_code == 200
    assert r.json()["splitwise_group_id"] == 7

    r = client.delete(f"/rules/{mid}")
    assert r.status_code == 204
    r = client.get(f"/rules/{mid}")
    assert r.status_code == 404


def test_apply_rule_when_enabled(client, fakes):
    from uuid import UUID as _UUID

    mid = uuid4()
    fakes["rules"]._rules[mid] = MerchantShareRule(
        merchant_id=mid,
        enabled=True,
        splitwise_group_id=1,
        split_method=SplitMethod.EQUAL,
        split_params={"member_ids": [1, 1234]},
        currency="ILS",
    )
    r = client.post(
        "/rules/apply",
        json={
            "payment_id": str(uuid4()),
            "merchant_id": str(mid),
            "amount": "50",
            "currency": "ILS",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["shared"] is True
    assert Decimal(body["my_share_amount"]) == Decimal("25.00")


def test_unshare_no_link_returns_noop(client):
    r = client.request("DELETE", f"/share/{uuid4()}", params={"delete_remote": "true"})
    assert r.status_code == 200
    body = r.json()
    assert body["delete_enqueued"] is False
    assert body["outbox_id"] is None


def test_failed_list_empty(client):
    r = client.get("/outbox/failed")
    assert r.status_code == 200
    assert r.json() == {"entries": []}


def test_failed_list_returns_failed_entries(client, fakes):
    import asyncio

    asyncio.run(
        fakes["outbox"].add(
            OutboxEntry(operation=OutboxOperation.PUSH, payload={}, status=OutboxStatus.FAILED)
        )
    )
    r = client.get("/outbox/failed")
    assert r.status_code == 200
    body = r.json()
    assert len(body["entries"]) == 1
    assert body["entries"][0]["status"] == "failed"


def await_count(outbox, status):
    import asyncio

    return asyncio.run(outbox.count_by_status(status))
