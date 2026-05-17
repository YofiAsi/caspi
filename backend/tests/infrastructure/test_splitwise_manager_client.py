from uuid import uuid4

import httpx
import pytest

from caspi.infrastructure import splitwise_manager_client as smc_mod
from caspi.infrastructure.splitwise_manager_client import (
    SplitwiseManagerClient,
    SplitwiseManagerError,
    SplitwiseManagerUnavailable,
)


@pytest.fixture
def mock_httpx(monkeypatch):
    """Replace httpx.AsyncClient in the client module with one bound to a MockTransport."""

    handlers: dict[str, object] = {"handler": lambda req: httpx.Response(404)}

    real_async_client = httpx.AsyncClient

    def _factory(*_a, **_kw):
        return real_async_client(transport=httpx.MockTransport(handlers["handler"]))

    monkeypatch.setattr(smc_mod.httpx, "AsyncClient", _factory)
    return handlers


def test_not_configured_property():
    assert SplitwiseManagerClient(None).configured is False
    assert SplitwiseManagerClient("").configured is False
    assert SplitwiseManagerClient("http://x").configured is True


async def test_unconfigured_get_status_raises_unavailable():
    with pytest.raises(SplitwiseManagerUnavailable):
        await SplitwiseManagerClient(None).get_status()


async def test_get_status_success(mock_httpx):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/status"
        return httpx.Response(200, json={"connected": True, "queued": 0, "failed": 0})

    mock_httpx["handler"] = handler
    res = await SplitwiseManagerClient("http://manager:8001").get_status()
    assert res["connected"] is True


async def test_5xx_raises_unavailable(mock_httpx):
    mock_httpx["handler"] = lambda _r: httpx.Response(503, text="down")
    with pytest.raises(SplitwiseManagerUnavailable):
        await SplitwiseManagerClient("http://m").get_status()


async def test_4xx_raises_error_with_detail(mock_httpx):
    mock_httpx["handler"] = lambda _r: httpx.Response(400, json={"detail": "bad request"})
    with pytest.raises(SplitwiseManagerError) as ei:
        await SplitwiseManagerClient("http://m").get_status()
    assert ei.value.status_code == 400
    assert ei.value.detail == "bad request"


async def test_network_error_raises_unavailable(mock_httpx):
    def handler(_r):
        raise httpx.ConnectError("no route")

    mock_httpx["handler"] = handler
    with pytest.raises(SplitwiseManagerUnavailable):
        await SplitwiseManagerClient("http://m").get_status()


async def test_get_rule_404_returns_none(mock_httpx):
    mock_httpx["handler"] = lambda _r: httpx.Response(404, json={"detail": "rule not found"})
    res = await SplitwiseManagerClient("http://m").get_rule(uuid4())
    assert res is None


async def test_unshare_passes_delete_remote_query(mock_httpx):
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["params"] = dict(request.url.params)
        captured["method"] = request.method
        return httpx.Response(200, json={"delete_enqueued": True, "outbox_id": None})

    mock_httpx["handler"] = handler
    await SplitwiseManagerClient("http://m").unshare(uuid4(), delete_remote=True)
    assert captured["params"] == {"delete_remote": "true"}
    assert captured["method"] == "DELETE"


async def test_disconnect_returns_none_on_204(mock_httpx):
    mock_httpx["handler"] = lambda _r: httpx.Response(204)
    result = await SplitwiseManagerClient("http://m").disconnect()
    assert result is None
