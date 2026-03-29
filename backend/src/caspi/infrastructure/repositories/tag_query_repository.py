from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

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


class SqlTagQueryRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_distinct_tags(self) -> list[str]:
        result = await self._session.execute(_TAGS_SQL)
        return [row[0] for row in result.fetchall()]
