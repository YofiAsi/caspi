from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.infrastructure.models import MerchantAliasModel


class SqlMerchantAliasRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def load_all_map(self) -> dict[str, str]:
        result = await self._session.execute(select(MerchantAliasModel))
        return {row.original_merchant: row.alias for row in result.scalars().all()}

    async def set_alias(self, original_merchant: str, alias: str | None) -> None:
        existing = await self._session.get(MerchantAliasModel, original_merchant)
        if alias:
            if existing:
                existing.alias = alias
            else:
                self._session.add(MerchantAliasModel(original_merchant=original_merchant, alias=alias))
        elif existing:
            await self._session.delete(existing)
