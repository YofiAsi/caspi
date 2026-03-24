from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.infrastructure.database import get_db

router = APIRouter(prefix="/api/tags", tags=["tags"])

_TAGS_SQL = text("""
    SELECT DISTINCT lower(trim(t)) AS tag
    FROM (
        SELECT jsonb_array_elements_text(coalesce(p.tags, '[]'::jsonb)) AS t
        FROM payments p
        UNION ALL
        SELECT jsonb_array_elements_text(coalesce(m.tags, '[]'::jsonb)) AS t
        FROM merchant_tags m
    ) x
    WHERE trim(t) <> ''
    ORDER BY 1
""")


class TagsResponse(BaseModel):
    tags: list[str]


@router.get("", response_model=TagsResponse)
async def list_tags(db: AsyncSession = Depends(get_db)) -> TagsResponse:
    result = await db.execute(_TAGS_SQL)
    tags = [row[0] for row in result.fetchall()]
    return TagsResponse(tags=tags)
