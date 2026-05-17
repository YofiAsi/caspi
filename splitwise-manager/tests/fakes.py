from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from splitwise_manager.domain.entities.merchant_share_rule import MerchantShareRule
from splitwise_manager.domain.entities.splitwise_link import SplitwiseLink
from splitwise_manager.domain.entities.splitwise_outbox_entry import OutboxEntry
from splitwise_manager.domain.repositories.credentials import StoredCredentials
from splitwise_manager.domain.value_objects.enums import OutboxStatus


class FakeCredentialsRepository:
    def __init__(self, initial: StoredCredentials | None = None) -> None:
        self._creds = initial

    async def load(self) -> StoredCredentials | None:
        return self._creds

    async def save(self, creds: StoredCredentials) -> None:
        self._creds = creds

    async def delete(self) -> None:
        self._creds = None


class FakeLinkRepository:
    def __init__(self) -> None:
        self._links: dict[UUID, SplitwiseLink] = {}

    async def get(self, payment_id: UUID) -> SplitwiseLink | None:
        return self._links.get(payment_id)

    async def upsert(self, link: SplitwiseLink) -> None:
        self._links[link.payment_id] = link

    async def delete(self, payment_id: UUID) -> None:
        self._links.pop(payment_id, None)


class FakeOutboxRepository:
    def __init__(self) -> None:
        self._entries: dict[UUID, OutboxEntry] = {}

    async def add(self, entry: OutboxEntry) -> None:
        if entry.created_at is None:
            entry.created_at = datetime.now(timezone.utc)
        entry.updated_at = datetime.now(timezone.utc)
        self._entries[entry.id] = entry

    async def get(self, entry_id: UUID) -> OutboxEntry | None:
        return self._entries.get(entry_id)

    async def update(self, entry: OutboxEntry) -> None:
        entry.updated_at = datetime.now(timezone.utc)
        self._entries[entry.id] = entry

    async def list_by_status(self, status: OutboxStatus, *, limit: int = 100) -> list[OutboxEntry]:
        return [e for e in self._entries.values() if e.status == status][:limit]

    async def list_due(self, *, limit: int = 100) -> list[OutboxEntry]:
        now = datetime.now(timezone.utc)
        out: list[OutboxEntry] = []
        for e in self._entries.values():
            if e.status != OutboxStatus.QUEUED:
                continue
            if e.next_attempt_at is None or e.next_attempt_at <= now:
                out.append(e)
        return out[:limit]

    async def count_by_status(self, status: OutboxStatus) -> int:
        return sum(1 for e in self._entries.values() if e.status == status)

    async def find_latest_for_payment(self, payment_id: UUID) -> OutboxEntry | None:
        matches = [e for e in self._entries.values() if e.payment_id == payment_id]
        if not matches:
            return None
        return sorted(matches, key=lambda e: e.updated_at or e.created_at or datetime.min.replace(tzinfo=timezone.utc))[-1]


class FakeRuleRepository:
    def __init__(self) -> None:
        self._rules: dict[UUID, MerchantShareRule] = {}

    async def get(self, merchant_id: UUID) -> MerchantShareRule | None:
        return self._rules.get(merchant_id)

    async def upsert(self, rule: MerchantShareRule) -> None:
        self._rules[rule.merchant_id] = rule

    async def delete(self, merchant_id: UUID) -> None:
        self._rules.pop(merchant_id, None)

    async def list_all(self) -> list[MerchantShareRule]:
        return list(self._rules.values())
