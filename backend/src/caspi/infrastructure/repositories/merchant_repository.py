from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.domain.repositories.merchant_repository import MerchantRepository
from caspi.domain.value_objects.ids import MerchantId
from caspi.infrastructure.models import MerchantModel, MerchantTagLinkModel


class SqlMerchantRepository(MerchantRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def ensure_by_canonical_name(self, canonical_name: str) -> MerchantId:
        c = canonical_name.strip().lower()
        result = await self._session.execute(select(MerchantModel).where(MerchantModel.canonical_name == c))
        row = result.scalar_one_or_none()
        if row:
            return MerchantId(row.id)
        m = MerchantModel(canonical_name=c, alias=None)
        self._session.add(m)
        await self._session.flush()
        return MerchantId(m.id)

    async def set_alias(self, merchant_id: MerchantId, alias: str | None) -> None:
        model = await self._session.get(MerchantModel, merchant_id.value)
        if model:
            model.alias = alias

    async def replace_tag_ids(self, merchant_id: MerchantId, tag_ids: list[UUID]) -> None:
        await self._session.execute(
            delete(MerchantTagLinkModel).where(MerchantTagLinkModel.merchant_id == merchant_id.value)
        )
        for tid in tag_ids:
            self._session.add(
                MerchantTagLinkModel(merchant_id=merchant_id.value, tag_id=tid),
            )

    async def load_tag_ids_by_merchant(self) -> dict[UUID, list[UUID]]:
        result = await self._session.execute(
            select(MerchantTagLinkModel.merchant_id, MerchantTagLinkModel.tag_id)
        )
        out: dict[UUID, list[UUID]] = {}
        for mid, tid in result.all():
            out.setdefault(mid, []).append(tid)
        for mid in out:
            out[mid] = sorted(out[mid])
        return out

    async def load_alias_and_canonical_by_merchant_id(self) -> dict[UUID, tuple[str | None, str]]:
        result = await self._session.execute(
            select(MerchantModel.id, MerchantModel.alias, MerchantModel.canonical_name)
        )
        return {row[0]: (row[1], row[2]) for row in result.all()}
