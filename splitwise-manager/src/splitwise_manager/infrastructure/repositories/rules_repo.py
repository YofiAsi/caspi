from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from splitwise_manager.domain.entities.merchant_share_rule import MerchantShareRule
from splitwise_manager.domain.repositories.rules import MerchantRuleRepository
from splitwise_manager.domain.value_objects.enums import SplitMethod
from splitwise_manager.infrastructure.models import MerchantShareRuleModel


def _to_domain(row: MerchantShareRuleModel) -> MerchantShareRule:
    return MerchantShareRule(
        id=row.id,
        merchant_id=row.merchant_id,
        enabled=row.enabled,
        splitwise_group_id=row.splitwise_group_id,
        split_method=SplitMethod(row.split_method),
        split_params=row.split_params or {},
        currency=row.currency,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class SqlMerchantRuleRepository(MerchantRuleRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get(self, merchant_id: UUID) -> MerchantShareRule | None:
        result = await self._session.execute(
            select(MerchantShareRuleModel).where(MerchantShareRuleModel.merchant_id == merchant_id)
        )
        row = result.scalar_one_or_none()
        return _to_domain(row) if row else None

    async def upsert(self, rule: MerchantShareRule) -> None:
        result = await self._session.execute(
            select(MerchantShareRuleModel).where(MerchantShareRuleModel.merchant_id == rule.merchant_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = MerchantShareRuleModel(
                id=rule.id,
                merchant_id=rule.merchant_id,
                enabled=rule.enabled,
                splitwise_group_id=rule.splitwise_group_id,
                split_method=rule.split_method.value,
                split_params=rule.split_params,
                currency=rule.currency,
            )
            self._session.add(row)
        else:
            row.enabled = rule.enabled
            row.splitwise_group_id = rule.splitwise_group_id
            row.split_method = rule.split_method.value
            row.split_params = rule.split_params
            row.currency = rule.currency
            row.updated_at = datetime.now(timezone.utc)
        await self._session.flush()

    async def delete(self, merchant_id: UUID) -> None:
        await self._session.execute(
            delete(MerchantShareRuleModel).where(MerchantShareRuleModel.merchant_id == merchant_id)
        )

    async def list_all(self) -> list[MerchantShareRule]:
        result = await self._session.execute(select(MerchantShareRuleModel))
        return [_to_domain(r) for r in result.scalars().all()]
