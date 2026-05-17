from __future__ import annotations

from typing import Protocol
from uuid import UUID

from splitwise_manager.domain.entities.splitwise_link import SplitwiseLink


class LinkRepository(Protocol):
    async def get(self, payment_id: UUID) -> SplitwiseLink | None: ...
    async def upsert(self, link: SplitwiseLink) -> None: ...
    async def delete(self, payment_id: UUID) -> None: ...
