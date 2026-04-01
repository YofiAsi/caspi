from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.domain.value_objects.tag import Tag
from caspi.infrastructure.database import get_db
from caspi.infrastructure.models import TagModel
from caspi.infrastructure.repositories.tag_query_repository import SqlTagQueryRepository

router = APIRouter(prefix="/api/tags", tags=["tags"])


class TagItem(BaseModel):
    id: str
    name: str


class TagsListResponse(BaseModel):
    tags: list[TagItem]


class CreateTagBody(BaseModel):
    name: str


@router.get("", response_model=TagsListResponse)
async def list_tags(db: AsyncSession = Depends(get_db)) -> TagsListResponse:
    rows = await SqlTagQueryRepository(db).list_all()
    return TagsListResponse(tags=[TagItem(id=str(i), name=n) for i, n in rows])


@router.post("", response_model=TagItem, status_code=201)
async def create_tag(body: CreateTagBody, db: AsyncSession = Depends(get_db)) -> TagItem:
    try:
        normalized = Tag(body.name).name
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    existing = await db.execute(select(TagModel).where(TagModel.name == normalized))
    row = existing.scalar_one_or_none()
    if row:
        return TagItem(id=str(row.id), name=row.name)
    t = TagModel(id=uuid4(), name=normalized)
    db.add(t)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing = await db.execute(select(TagModel).where(TagModel.name == normalized))
        row = existing.scalar_one()
        return TagItem(id=str(row.id), name=row.name)
    await db.refresh(t)
    return TagItem(id=str(t.id), name=t.name)
