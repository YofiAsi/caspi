from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass
class StoredCredentials:
    consumer_key: str
    consumer_secret: str
    api_key: str
    splitwise_user_id: int | None = None
    last_validated_at: datetime | None = None


class CredentialsRepository(Protocol):
    async def load(self) -> StoredCredentials | None: ...
    async def save(self, creds: StoredCredentials) -> None: ...
    async def delete(self) -> None: ...
