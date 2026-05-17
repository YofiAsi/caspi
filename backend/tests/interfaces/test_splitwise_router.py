from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from caspi.infrastructure.splitwise_manager_client import (
    SplitwiseManagerError,
    SplitwiseManagerUnavailable,
)
from caspi.interfaces.app import app
from caspi.interfaces.routers import splitwise as sw_router


class FakeClient:
    def __init__(self) -> None:
        self.calls: list[tuple] = []
        self.status_payload: dict = {"connected": False, "queued": 0, "failed": 0}
        self.raise_with: Exception | None = None

    def _maybe_raise(self):
        if self.raise_with:
            raise self.raise_with

    async def get_status(self):
        self.calls.append(("get_status",))
        self._maybe_raise()
        return self.status_payload

    async def connect(self, **kw):
        self.calls.append(("connect", kw))
        self._maybe_raise()
        return {"source": "db", "splitwise_user_id": 42}

    async def disconnect(self):
        self.calls.append(("disconnect",))
        self._maybe_raise()

    async def list_groups(self):
        self.calls.append(("list_groups",))
        self._maybe_raise()
        return {"groups": []}

    async def share(self, body):
        self.calls.append(("share", body))
        self._maybe_raise()
        return {"my_share_amount": "10.00", "my_share_currency": "ILS", "outbox_id": str(uuid4())}

    async def unshare(self, payment_id, *, delete_remote):
        self.calls.append(("unshare", str(payment_id), delete_remote))
        self._maybe_raise()
        return {"delete_enqueued": delete_remote, "outbox_id": None}

    async def get_rule(self, merchant_id):
        self.calls.append(("get_rule", str(merchant_id)))
        self._maybe_raise()
        return None

    async def put_rule(self, merchant_id, body):
        self.calls.append(("put_rule", str(merchant_id), body))
        self._maybe_raise()
        return {"merchant_id": str(merchant_id), **body}

    async def delete_rule(self, merchant_id):
        self.calls.append(("delete_rule", str(merchant_id)))
        self._maybe_raise()

    async def apply_rule(self, body):
        self.calls.append(("apply_rule", body))
        self._maybe_raise()
        return {"shared": False}

    async def list_failed(self, limit=100):
        self.calls.append(("list_failed", limit))
        self._maybe_raise()
        return {"entries": []}

    async def retry(self, payment_id):
        self.calls.append(("retry", str(payment_id)))
        self._maybe_raise()
        return {"outbox_id": None, "requeued": False}


@pytest.fixture
def fake(monkeypatch):
    fc = FakeClient()
    monkeypatch.setattr(sw_router, "_client", lambda: fc)
    return fc


@pytest.fixture
def client():
    return TestClient(app)


def test_status_passes_through(fake, client):
    fake.status_payload = {"connected": True, "queued": 3, "failed": 1, "source": "env"}
    r = client.get("/api/splitwise/status")
    assert r.status_code == 200
    assert r.json()["connected"] is True


def test_status_returns_503_when_manager_unavailable(fake, client):
    fake.raise_with = SplitwiseManagerUnavailable("down")
    r = client.get("/api/splitwise/status")
    assert r.status_code == 503


def test_status_propagates_4xx_from_manager(fake, client):
    fake.raise_with = SplitwiseManagerError(400, "bad")
    r = client.get("/api/splitwise/status")
    assert r.status_code == 400
    assert r.json()["detail"] == "bad"


def test_share_passes_body_through(fake, client):
    pid = str(uuid4())
    body = {
        "payment_id": pid,
        "amount": "30",
        "currency": "ILS",
        "group_id": 1,
        "split_method": "equal",
        "split_params": {"member_ids": [1, 2]},
    }
    r = client.post("/api/splitwise/share", json=body)
    assert r.status_code == 200
    assert fake.calls[-1] == ("share", body)


def test_unshare_passes_delete_remote(fake, client):
    pid = uuid4()
    r = client.request("DELETE", f"/api/splitwise/share/{pid}", params={"delete_remote": "true"})
    assert r.status_code == 200
    assert fake.calls[-1] == ("unshare", str(pid), True)


def test_unshare_defaults_delete_remote_false(fake, client):
    pid = uuid4()
    r = client.request("DELETE", f"/api/splitwise/share/{pid}")
    assert r.status_code == 200
    assert fake.calls[-1] == ("unshare", str(pid), False)


def test_get_rule_404_propagated(fake, client):
    r = client.get(f"/api/splitwise/rules/{uuid4()}")
    assert r.status_code == 404


def test_put_rule(fake, client):
    mid = uuid4()
    body = {
        "enabled": True,
        "splitwise_group_id": 1,
        "split_method": "equal",
        "split_params": {"member_ids": [1, 2]},
        "currency": "ILS",
    }
    r = client.put(f"/api/splitwise/rules/{mid}", json=body)
    assert r.status_code == 200
    assert fake.calls[-1] == ("put_rule", str(mid), body)


def test_delete_rule(fake, client):
    mid = uuid4()
    r = client.delete(f"/api/splitwise/rules/{mid}")
    assert r.status_code == 204
    assert fake.calls[-1] == ("delete_rule", str(mid))


def test_failed_passes_limit(fake, client):
    r = client.get("/api/splitwise/outbox/failed", params={"limit": 50})
    assert r.status_code == 200
    assert fake.calls[-1] == ("list_failed", 50)


def test_retry(fake, client):
    pid = uuid4()
    r = client.post(f"/api/splitwise/retry/{pid}")
    assert r.status_code == 200
    assert fake.calls[-1] == ("retry", str(pid))
