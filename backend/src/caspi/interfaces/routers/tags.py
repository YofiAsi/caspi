from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.tags import create_tag as app_create_tag
from caspi.domain.value_objects.tag import Tag
from caspi.infrastructure.database import get_db
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
        Tag(body.name)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    tid, name = await app_create_tag(db, body.name)
    await db.commit()
    return TagItem(id=str(tid), name=name)
