from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from splitwise_manager.domain.entities.merchant_share_rule import MerchantShareRule
from splitwise_manager.domain.repositories.rules import MerchantRuleRepository
from splitwise_manager.domain.value_objects.enums import SplitMethod


@dataclass
class UpsertRuleRequest:
    merchant_id: UUID
    enabled: bool
    splitwise_group_id: int
    split_method: SplitMethod
    split_params: dict
    currency: str = "ILS"


async def upsert_rule(
    request: UpsertRuleRequest,
    *,
    rule_repo: MerchantRuleRepository,
) -> MerchantShareRule:
    existing = await rule_repo.get(request.merchant_id)
    if existing is None:
        rule = MerchantShareRule(
            merchant_id=request.merchant_id,
            enabled=request.enabled,
            splitwise_group_id=request.splitwise_group_id,
            split_method=request.split_method,
            split_params=request.split_params,
            currency=request.currency,
        )
    else:
        existing.enabled = request.enabled
        existing.splitwise_group_id = request.splitwise_group_id
        existing.split_method = request.split_method
        existing.split_params = request.split_params
        existing.currency = request.currency
        rule = existing
    await rule_repo.upsert(rule)
    return rule


async def get_rule(merchant_id: UUID, *, rule_repo: MerchantRuleRepository) -> MerchantShareRule | None:
    return await rule_repo.get(merchant_id)


async def delete_rule(merchant_id: UUID, *, rule_repo: MerchantRuleRepository) -> None:
    await rule_repo.delete(merchant_id)
