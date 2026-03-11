from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.domain.entities.sharing_rule import SharingRule
from caspi.domain.value_objects.enums import ShareType
from caspi.domain.value_objects.ids import RuleId
from caspi.infrastructure.database import get_db
from caspi.infrastructure.repositories import SqlSharingRuleRepository

router = APIRouter(prefix="/api/sharing-rules", tags=["sharing-rules"])


class SharingRuleBody(BaseModel):
    merchant_key: str
    share_type: ShareType
    share_value: Decimal
    currency: str = "ILS"
    label: str | None = None


class SharingRuleResponse(BaseModel):
    rule_id: str
    merchant_key: str
    share_type: ShareType
    share_value: Decimal
    currency: str
    label: str | None
    created_at: str


def _to_response(rule: SharingRule) -> SharingRuleResponse:
    return SharingRuleResponse(
        rule_id=str(rule.rule_id.value),
        merchant_key=rule.merchant_key,
        share_type=rule.share_type,
        share_value=rule.share_value,
        currency=rule.currency,
        label=rule.label,
        created_at=rule.created_at.isoformat(),
    )


@router.post("", response_model=SharingRuleResponse, status_code=201)
async def create_sharing_rule(body: SharingRuleBody, db: AsyncSession = Depends(get_db)):
    try:
        rule = SharingRule(
            rule_id=RuleId(),
            merchant_key=body.merchant_key,
            share_type=body.share_type,
            share_value=body.share_value,
            currency=body.currency,
            label=body.label,
            created_at=datetime.now(timezone.utc),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    repo = SqlSharingRuleRepository(db)
    await repo.save(rule)
    await db.commit()
    return _to_response(rule)


@router.get("", response_model=list[SharingRuleResponse])
async def list_sharing_rules(db: AsyncSession = Depends(get_db)):
    rules = await SqlSharingRuleRepository(db).find_all()
    return [_to_response(r) for r in rules]


@router.delete("/{rule_id}", status_code=204)
async def delete_sharing_rule(rule_id: str, db: AsyncSession = Depends(get_db)):
    try:
        rid = RuleId(UUID(rule_id))
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid rule_id format")

    repo = SqlSharingRuleRepository(db)
    if not await repo.find_by_id(rid):
        raise HTTPException(status_code=404, detail="Rule not found")

    await repo.delete(rid)
    await db.commit()
