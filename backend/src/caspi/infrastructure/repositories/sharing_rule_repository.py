from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.domain.entities.sharing_rule import SharingRule
from caspi.domain.repositories.sharing_rule_repository import SharingRuleRepository
from caspi.domain.value_objects.enums import ShareType
from caspi.domain.value_objects.ids import RuleId
from caspi.infrastructure.models import SharingRuleModel


def _to_domain(model: SharingRuleModel) -> SharingRule:
    return SharingRule(
        rule_id=RuleId(model.rule_id),
        merchant_key=model.merchant_key,
        share_type=ShareType(model.share_type),
        share_value=model.share_value,
        currency=model.currency,
        label=model.label,
        created_at=model.created_at,
    )


def _to_orm(rule: SharingRule) -> SharingRuleModel:
    return SharingRuleModel(
        rule_id=rule.rule_id.value,
        merchant_key=rule.merchant_key,
        share_type=rule.share_type.value,
        share_value=rule.share_value,
        currency=rule.currency,
        label=rule.label,
        created_at=rule.created_at,
    )


class SqlSharingRuleRepository(SharingRuleRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, rule: SharingRule) -> None:
        existing = await self._session.get(SharingRuleModel, rule.rule_id.value)
        if existing:
            existing.merchant_key = rule.merchant_key
            existing.share_type = rule.share_type.value
            existing.share_value = rule.share_value
            existing.currency = rule.currency
            existing.label = rule.label
        else:
            self._session.add(_to_orm(rule))

    async def find_by_id(self, rule_id: RuleId) -> SharingRule | None:
        model = await self._session.get(SharingRuleModel, rule_id.value)
        return _to_domain(model) if model else None

    async def find_all(self) -> list[SharingRule]:
        result = await self._session.execute(select(SharingRuleModel))
        return [_to_domain(m) for m in result.scalars().all()]

    async def delete(self, rule_id: RuleId) -> None:
        await self._session.execute(
            delete(SharingRuleModel).where(SharingRuleModel.rule_id == rule_id.value)
        )
