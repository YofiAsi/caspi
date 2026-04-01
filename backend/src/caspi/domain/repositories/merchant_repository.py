from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from caspi.domain.value_objects.ids import MerchantId


class MerchantRepository(ABC):
    @abstractmethod
    async def ensure_by_canonical_name(self, canonical_name: str) -> MerchantId: ...

    @abstractmethod
    async def set_alias(self, merchant_id: MerchantId, alias: str | None) -> None: ...

    @abstractmethod
    async def replace_tag_ids(self, merchant_id: MerchantId, tag_ids: list[UUID]) -> None: ...
