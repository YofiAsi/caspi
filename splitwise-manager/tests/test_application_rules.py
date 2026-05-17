from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from splitwise_manager.application.apply_rule import ApplyRuleRequest, apply_rule
from splitwise_manager.application.merchant_rules import (
    UpsertRuleRequest,
    delete_rule,
    get_rule,
    upsert_rule,
)
from splitwise_manager.domain.entities.merchant_share_rule import MerchantShareRule
from splitwise_manager.domain.repositories.credentials import StoredCredentials
from splitwise_manager.domain.value_objects.enums import OutboxStatus, SplitMethod
from tests.fakes import (
    FakeCredentialsRepository,
    FakeLinkRepository,
    FakeOutboxRepository,
    FakeRuleRepository,
)


async def test_upsert_creates_then_updates():
    rules = FakeRuleRepository()
    mid = uuid4()
    req = UpsertRuleRequest(
        merchant_id=mid,
        enabled=True,
        splitwise_group_id=10,
        split_method=SplitMethod.EQUAL,
        split_params={"member_ids": [1, 2]},
    )
    r1 = await upsert_rule(req, rule_repo=rules)
    assert r1.enabled is True

    req.enabled = False
    r2 = await upsert_rule(req, rule_repo=rules)
    assert r2.enabled is False
    assert (await get_rule(mid, rule_repo=rules)).enabled is False

    await delete_rule(mid, rule_repo=rules)
    assert await get_rule(mid, rule_repo=rules) is None


async def test_apply_rule_no_rule_does_nothing():
    rules = FakeRuleRepository()
    result = await apply_rule(
        ApplyRuleRequest(
            payment_id=uuid4(),
            merchant_id=uuid4(),
            amount=Decimal("10"),
            currency="ILS",
        ),
        rule_repo=rules,
        creds_repo=FakeCredentialsRepository(None),
        link_repo=FakeLinkRepository(),
        outbox_repo=FakeOutboxRepository(),
    )
    assert result.shared is False


async def test_apply_rule_disabled_does_nothing():
    rules = FakeRuleRepository()
    mid = uuid4()
    await rules.upsert(
        MerchantShareRule(
            merchant_id=mid,
            enabled=False,
            splitwise_group_id=10,
            split_method=SplitMethod.EQUAL,
            split_params={"member_ids": [1, 1234]},
        )
    )
    result = await apply_rule(
        ApplyRuleRequest(
            payment_id=uuid4(),
            merchant_id=mid,
            amount=Decimal("10"),
            currency="ILS",
        ),
        rule_repo=rules,
        creds_repo=FakeCredentialsRepository(None),
        link_repo=FakeLinkRepository(),
        outbox_repo=FakeOutboxRepository(),
    )
    assert result.shared is False


async def test_apply_rule_enabled_shares():
    rules = FakeRuleRepository()
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
    mid = uuid4()
    await rules.upsert(
        MerchantShareRule(
            merchant_id=mid,
            enabled=True,
            splitwise_group_id=10,
            split_method=SplitMethod.EQUAL,
            split_params={"member_ids": [1, 1234]},
            currency="ILS",
        )
    )

    result = await apply_rule(
        ApplyRuleRequest(
            payment_id=uuid4(),
            merchant_id=mid,
            amount=Decimal("50"),
            currency="ILS",
            description="coffee",
        ),
        rule_repo=rules,
        creds_repo=creds,
        link_repo=links,
        outbox_repo=outbox,
    )
    assert result.shared is True
    assert result.my_share_amount == Decimal("25.00")
    assert await outbox.count_by_status(OutboxStatus.QUEUED) == 1
