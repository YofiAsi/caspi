from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.infrastructure.models import MerchantTagModel


class SqlMerchantTagRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def load_all_map(self) -> dict[str, list[str]]:
        result = await self._session.execute(select(MerchantTagModel))
        return {row.merchant_key: list(row.tags or []) for row in result.scalars().all()}

    async def replace_tags_for_merchant(self, merchant_key: str, tags_value: list[str]) -> None:
        normalized = [str(t).strip().lower() for t in tags_value if str(t).strip()]
        row = await self._session.get(MerchantTagModel, merchant_key)
        if not normalized:
            if row:
                await self._session.delete(row)
            return
        if row:
            row.tags = normalized
        else:
            self._session.add(MerchantTagModel(merchant_key=merchant_key, tags=normalized))
