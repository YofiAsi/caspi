from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.infrastructure.database import get_db
from caspi.infrastructure.models import TagModel
from caspi.interfaces.dependencies import get_user_id
from caspi.interfaces.schemas import TagCreate, TagOut, TagUpdate

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("", response_model=list[TagOut])
async def list_tags(user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TagModel).where(TagModel.user_id == user_id).order_by(TagModel.name)
    )
    return [TagOut(id=t.id, name=t.name) for t in result.scalars()]


@router.post("", response_model=TagOut, status_code=201)
async def create_tag(body: TagCreate, user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    # Idempotent: return existing if name matches (case-insensitive)
    result = await db.execute(
        select(TagModel).where(TagModel.user_id == user_id, func.lower(TagModel.name) == body.name.strip().lower())
    )
    existing = result.scalar_one_or_none()
    if existing:
        return TagOut(id=existing.id, name=existing.name)

    tag = TagModel(id=uuid.uuid4(), user_id=user_id, name=body.name.strip())
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return TagOut(id=tag.id, name=tag.name)


@router.put("/{tag_id}", response_model=TagOut)
async def update_tag(
    tag_id: uuid.UUID, body: TagUpdate,
    user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TagModel).where(TagModel.id == tag_id, TagModel.user_id == user_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(404)
    tag.name = body.name.strip()
    await db.commit()
    await db.refresh(tag)
    return TagOut(id=tag.id, name=tag.name)


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(
    tag_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TagModel).where(TagModel.id == tag_id, TagModel.user_id == user_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(404)
    await db.execute(delete(TagModel).where(TagModel.id == tag_id))
    await db.commit()
