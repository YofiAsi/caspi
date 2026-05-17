from __future__ import annotations

from dataclasses import dataclass
from datetime import date as date_t
from decimal import Decimal
from typing import Callable
from uuid import UUID

from splitwise_manager.application.share_payment import (
    SharePaymentRequest,
    share_payment,
)
from splitwise_manager.domain.repositories.credentials import CredentialsRepository
from splitwise_manager.domain.repositories.links import LinkRepository
from splitwise_manager.domain.repositories.outbox import OutboxRepository
from splitwise_manager.domain.repositories.rules import MerchantRuleRepository


@dataclass
class ApplyRuleRequest:
    payment_id: UUID
    merchant_id: UUID
    amount: Decimal
    currency: str
    description: str = ""
    date: date_t | None = None


@dataclass
class ApplyRuleResult:
    shared: bool
    my_share_amount: Decimal | None = None
    my_share_currency: str | None = None


async def apply_rule(
    request: ApplyRuleRequest,
    *,
    rule_repo: MerchantRuleRepository,
    creds_repo: CredentialsRepository,
    link_repo: LinkRepository,
    outbox_repo: OutboxRepository,
    dispatch_push: Callable[[str], None] | None = None,
) -> ApplyRuleResult:
    rule = await rule_repo.get(request.merchant_id)
    if rule is None or not rule.enabled:
        return ApplyRuleResult(shared=False)

    share_req = SharePaymentRequest(
        payment_id=request.payment_id,
        amount=request.amount,
        currency=rule.currency or request.currency,
        group_id=rule.splitwise_group_id,
        split_method=rule.split_method,
        split_params=rule.split_params,
        description=request.description,
        date=request.date,
    )
    result = await share_payment(
        share_req,
        creds_repo=creds_repo,
        link_repo=link_repo,
        outbox_repo=outbox_repo,
        dispatch_push=dispatch_push,
    )
    return ApplyRuleResult(
        shared=True,
        my_share_amount=result.my_share_amount,
        my_share_currency=result.my_share_currency,
    )
