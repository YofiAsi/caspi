from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from splitwise_manager.application.share_payment import SharePaymentRequest, share_payment
from splitwise_manager.application.unshare_payment import unshare_payment
from splitwise_manager.domain.entities.splitwise_link import SplitwiseLink
from splitwise_manager.domain.repositories.credentials import StoredCredentials
from splitwise_manager.domain.value_objects.enums import (
    LinkStatus,
    OutboxOperation,
    OutboxStatus,
    SplitMethod,
)
from tests.fakes import FakeCredentialsRepository, FakeLinkRepository, FakeOutboxRepository


@pytest.fixture
def creds_with_user():
    return FakeCredentialsRepository(
        StoredCredentials(
            consumer_key="k",
            consumer_secret="s",
            api_key="a",
            splitwise_user_id=1234,
            last_validated_at=datetime.now(timezone.utc),
        )
    )


async def test_share_payment_creates_link_and_outbox(creds_with_user):
    links = FakeLinkRepository()
    outbox = FakeOutboxRepository()
    payment_id = uuid4()
    dispatched: list[str] = []

    result = await share_payment(
        SharePaymentRequest(
            payment_id=payment_id,
            amount=Decimal("90.00"),
            currency="ILS",
            group_id=42,
            split_method=SplitMethod.EQUAL,
            split_params={"member_ids": [1, 2, 1234]},
            description="lunch",
            date=date(2026, 5, 17),
        ),
        creds_repo=creds_with_user,
        link_repo=links,
        outbox_repo=outbox,
        dispatch_push=dispatched.append,
    )

    assert result.my_share_amount == Decimal("30.00")
    assert result.my_share_currency == "ILS"

    link = await links.get(payment_id)
    assert link is not None
    assert link.status == LinkStatus.PENDING
    assert link.splitwise_group_id == 42

    assert await outbox.count_by_status(OutboxStatus.QUEUED) == 1
    assert dispatched == [str(result.outbox_id)]


async def test_share_payment_without_creds_raises():
    from splitwise_manager.infrastructure.splitwise_client import SplitwiseAPIError

    with pytest.raises(SplitwiseAPIError):
        await share_payment(
            SharePaymentRequest(
                payment_id=uuid4(),
                amount=Decimal("10"),
                currency="ILS",
                group_id=1,
                split_method=SplitMethod.EQUAL,
                split_params={"member_ids": [1, 1234]},
            ),
            creds_repo=FakeCredentialsRepository(None),
            link_repo=FakeLinkRepository(),
            outbox_repo=FakeOutboxRepository(),
        )


async def test_unshare_no_link_returns_noop():
    result = await unshare_payment(
        payment_id=uuid4(),
        delete_remote=True,
        link_repo=FakeLinkRepository(),
        outbox_repo=FakeOutboxRepository(),
    )
    assert result.delete_enqueued is False
    assert result.outbox_id is None


async def test_unshare_without_delete_remote_just_drops_link():
    links = FakeLinkRepository()
    outbox = FakeOutboxRepository()
    pid = uuid4()
    await links.upsert(
        SplitwiseLink(
            payment_id=pid,
            splitwise_group_id=1,
            status=LinkStatus.PUSHED,
            splitwise_expense_id=9999,
        )
    )

    result = await unshare_payment(
        payment_id=pid,
        delete_remote=False,
        link_repo=links,
        outbox_repo=outbox,
    )
    assert result.delete_enqueued is False
    assert await links.get(pid) is None
    assert await outbox.count_by_status(OutboxStatus.QUEUED) == 0


async def test_unshare_with_delete_remote_enqueues_outbox():
    links = FakeLinkRepository()
    outbox = FakeOutboxRepository()
    dispatched: list[str] = []
    pid = uuid4()
    await links.upsert(
        SplitwiseLink(
            payment_id=pid,
            splitwise_group_id=1,
            status=LinkStatus.PUSHED,
            splitwise_expense_id=9999,
        )
    )

    result = await unshare_payment(
        payment_id=pid,
        delete_remote=True,
        link_repo=links,
        outbox_repo=outbox,
        dispatch_delete=dispatched.append,
    )
    assert result.delete_enqueued is True
    queued = await outbox.list_by_status(OutboxStatus.QUEUED)
    assert len(queued) == 1
    assert queued[0].operation == OutboxOperation.DELETE
    assert queued[0].payload == {"splitwise_expense_id": 9999}
    assert dispatched == [str(queued[0].id)]
