from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.infrastructure.database import get_db
from caspi.infrastructure.repositories.tag_query_repository import SqlTagQueryRepository

router = APIRouter(prefix="/api/tags", tags=["tags"])


class TagsResponse(BaseModel):
    tags: list[str]


@router.get("", response_model=TagsResponse)
async def list_tags(db: AsyncSession = Depends(get_db)) -> TagsResponse:
    tags = await SqlTagQueryRepository(db).list_distinct_tags()
    return TagsResponse(tags=tags)
