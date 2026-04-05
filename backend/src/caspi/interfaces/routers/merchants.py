from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.infrastructure.database import get_db
from caspi.infrastructure.models import MerchantModel, TagModel, merchant_tags
from caspi.interfaces.dependencies import get_user_id
from caspi.interfaces.schemas import MerchantOut, MerchantUpdate, TagOut

router = APIRouter(prefix="/api/merchants", tags=["merchants"])


def _merchant_out(m: MerchantModel) -> MerchantOut:
    return MerchantOut(
        id=m.id,
        canonical_name=m.canonical_name,
        alias=m.alias,
        default_share=m.default_share,
        default_share_amount=m.default_share_amount,
        tags=[TagOut(id=t.id, name=t.name) for t in m.tags],
    )


@router.get("", response_model=list[MerchantOut])
async def list_merchants(
    q: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    user_id: uuid.UUID = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(MerchantModel).where(MerchantModel.user_id == user_id)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                func.lower(MerchantModel.canonical_name).contains(q.lower()),
                func.lower(MerchantModel.alias).contains(q.lower()),
            )
        )
    stmt = stmt.order_by(MerchantModel.canonical_name).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return [_merchant_out(m) for m in result.scalars()]


@router.get("/{merchant_id}", response_model=MerchantOut)
async def get_merchant(
    merchant_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MerchantModel).where(MerchantModel.id == merchant_id, MerchantModel.user_id == user_id)
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(404)
    return _merchant_out(m)


@router.put("/{merchant_id}", response_model=MerchantOut)
async def update_merchant(
    merchant_id: uuid.UUID, body: MerchantUpdate,
    user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MerchantModel).where(MerchantModel.id == merchant_id, MerchantModel.user_id == user_id)
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(404)

    if body.alias is not None:
        m.alias = body.alias
    if body.default_share is not None:
        m.default_share = body.default_share
    if body.default_share_amount is not None:
        m.default_share_amount = body.default_share_amount

    # Replace tags
    if body.tag_ids is not None:
        tag_result = await db.execute(
            select(TagModel).where(TagModel.id.in_(body.tag_ids), TagModel.user_id == user_id)
        )
        m.tags = list(tag_result.scalars())

    await db.commit()
    await db.refresh(m)
    return _merchant_out(m)
