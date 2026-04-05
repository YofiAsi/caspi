from __future__ import annotations

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.infrastructure.database import get_db
from caspi.infrastructure.models import CollectionModel, ExpenseModel, TagModel, expense_tags
from caspi.interfaces.dependencies import get_user_id
from caspi.interfaces.schemas import (
    CollectionCreate,
    CollectionDetailOut,
    CollectionOut,
    CollectionStats,
    CollectionUpdate,
    TagTotal,
)

router = APIRouter(prefix="/api/collections", tags=["collections"])


@router.get("", response_model=list[CollectionOut])
async def list_collections(user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CollectionModel).where(CollectionModel.user_id == user_id).order_by(CollectionModel.name)
    )
    return [CollectionOut(id=c.id, name=c.name, start_date=c.start_date, end_date=c.end_date) for c in result.scalars()]


@router.get("/{collection_id}", response_model=CollectionDetailOut)
async def get_collection(
    collection_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CollectionModel).where(CollectionModel.id == collection_id, CollectionModel.user_id == user_id)
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404)

    # Stats
    stats_result = await db.execute(
        select(
            func.coalesce(func.sum(ExpenseModel.personal_amount), 0),
            func.count(ExpenseModel.id),
        ).where(ExpenseModel.collection_id == collection_id, ExpenseModel.user_id == user_id)
    )
    row = stats_result.one()
    total_personal = row[0]
    expense_count = row[1]

    # By tag
    by_tag_result = await db.execute(
        select(
            TagModel.name,
            func.sum(ExpenseModel.personal_amount),
        )
        .join(expense_tags, expense_tags.c.expense_id == ExpenseModel.id)
        .join(TagModel, TagModel.id == expense_tags.c.tag_id)
        .where(ExpenseModel.collection_id == collection_id, ExpenseModel.user_id == user_id)
        .group_by(TagModel.name)
        .order_by(func.sum(ExpenseModel.personal_amount).desc())
    )

    return CollectionDetailOut(
        id=c.id,
        name=c.name,
        start_date=c.start_date,
        end_date=c.end_date,
        stats=CollectionStats(
            total_personal=Decimal(str(total_personal)),
            expense_count=expense_count,
            by_tag=[TagTotal(tag=name, total=Decimal(str(total))) for name, total in by_tag_result],
        ),
    )


@router.post("", response_model=CollectionOut, status_code=201)
async def create_collection(
    body: CollectionCreate,
    user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db),
):
    c = CollectionModel(
        id=uuid.uuid4(), user_id=user_id,
        name=body.name.strip(), start_date=body.start_date, end_date=body.end_date,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return CollectionOut(id=c.id, name=c.name, start_date=c.start_date, end_date=c.end_date)


@router.put("/{collection_id}", response_model=CollectionOut)
async def update_collection(
    collection_id: uuid.UUID, body: CollectionUpdate,
    user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CollectionModel).where(CollectionModel.id == collection_id, CollectionModel.user_id == user_id)
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404)
    if body.name is not None:
        c.name = body.name.strip()
    if body.start_date is not None:
        c.start_date = body.start_date
    if body.end_date is not None:
        c.end_date = body.end_date
    await db.commit()
    await db.refresh(c)
    return CollectionOut(id=c.id, name=c.name, start_date=c.start_date, end_date=c.end_date)


@router.delete("/{collection_id}", status_code=204)
async def delete_collection(
    collection_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CollectionModel).where(CollectionModel.id == collection_id, CollectionModel.user_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404)
    await db.execute(delete(CollectionModel).where(CollectionModel.id == collection_id))
    await db.commit()
