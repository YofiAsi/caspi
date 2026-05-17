from datetime import datetime, timezone
from uuid import uuid4

import pytest

from splitwise_manager.application.connect import ConnectRequest, connect
from splitwise_manager.application.get_status import get_status
from splitwise_manager.application.list_failed import list_failed
from splitwise_manager.application.retry import retry_payment
from splitwise_manager.domain.entities.splitwise_outbox_entry import OutboxEntry
from splitwise_manager.domain.repositories.credentials import StoredCredentials
from splitwise_manager.domain.value_objects.enums import OutboxOperation, OutboxStatus
from splitwise_manager.infrastructure.splitwise_client import SplitwiseAPIError
from tests.fakes import FakeCredentialsRepository, FakeOutboxRepository


class _StubClient:
    def __init__(self, *_args, **_kw):
        pass

    async def validate(self) -> int:
        return 4242


class _FailingClient:
    def __init__(self, *_args, **_kw):
        pass

    async def validate(self) -> int:
        raise SplitwiseAPIError("nope")


async def test_status_disconnected_when_no_creds():
    res = await get_status(
        creds_repo=FakeCredentialsRepository(None),
        outbox_repo=FakeOutboxRepository(),
    )
    assert res.connected is False
    assert res.queued == 0
    assert res.failed == 0


async def test_status_counts_queued_and_failed():
    outbox = FakeOutboxRepository()
    await outbox.add(OutboxEntry(operation=OutboxOperation.PUSH, payload={}, status=OutboxStatus.QUEUED))
    await outbox.add(OutboxEntry(operation=OutboxOperation.PUSH, payload={}, status=OutboxStatus.FAILED))
    await outbox.add(OutboxEntry(operation=OutboxOperation.PUSH, payload={}, status=OutboxStatus.FAILED))

    res = await get_status(
        creds_repo=FakeCredentialsRepository(
            StoredCredentials(
                consumer_key="k",
                consumer_secret="s",
                api_key="a",
                splitwise_user_id=99,
                last_validated_at=datetime.now(timezone.utc),
            )
        ),
        outbox_repo=outbox,
    )
    assert res.connected is True
    assert res.queued == 1
    assert res.failed == 2
    assert res.splitwise_user_id == 99


async def test_connect_db_path_persists_when_validation_succeeds():
    creds = FakeCredentialsRepository(None)
    result = await connect(
        ConnectRequest(consumer_key="k", consumer_secret="s", api_key="a"),
        creds_repo=creds,
        client_factory=_StubClient,
    )
    assert result.source == "db"
    assert result.splitwise_user_id == 4242
    stored = await creds.load()
    assert stored is not None
    assert stored.splitwise_user_id == 4242


async def test_connect_invalid_credentials_does_not_persist():
    creds = FakeCredentialsRepository(None)
    with pytest.raises(SplitwiseAPIError):
        await connect(
            ConnectRequest(consumer_key="k", consumer_secret="s", api_key="a"),
            creds_repo=creds,
            client_factory=_FailingClient,
        )
    assert await creds.load() is None


async def test_list_failed_returns_only_failed():
    outbox = FakeOutboxRepository()
    await outbox.add(OutboxEntry(operation=OutboxOperation.PUSH, payload={}, status=OutboxStatus.QUEUED))
    await outbox.add(OutboxEntry(operation=OutboxOperation.PUSH, payload={}, status=OutboxStatus.FAILED))
    failed = await list_failed(outbox_repo=outbox)
    assert len(failed) == 1
    assert failed[0].status == OutboxStatus.FAILED


async def test_retry_resets_and_dispatches():
    outbox = FakeOutboxRepository()
    pid = uuid4()
    entry = OutboxEntry(
        operation=OutboxOperation.PUSH,
        payload={"x": 1},
        payment_id=pid,
        attempts=5,
        last_error="boom",
        status=OutboxStatus.FAILED,
    )
    await outbox.add(entry)

    dispatched: list[str] = []
    result = await retry_payment(
        pid,
        outbox_repo=outbox,
        dispatch_push=dispatched.append,
    )
    assert result.requeued is True
    refreshed = await outbox.get(entry.id)
    assert refreshed.status == OutboxStatus.QUEUED
    assert refreshed.attempts == 0
    assert refreshed.last_error is None
    assert dispatched == [str(entry.id)]


async def test_retry_unknown_payment_returns_not_requeued():
    result = await retry_payment(
        uuid4(),
        outbox_repo=FakeOutboxRepository(),
    )
    assert result.requeued is False
    assert result.outbox_id is None
