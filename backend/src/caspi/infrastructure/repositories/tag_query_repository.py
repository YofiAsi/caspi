from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.infrastructure.models import TagModel


class SqlTagQueryRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_all(self) -> list[tuple]:
        result = await self._session.execute(select(TagModel.id, TagModel.name).order_by(TagModel.name))
        return list(result.all())
