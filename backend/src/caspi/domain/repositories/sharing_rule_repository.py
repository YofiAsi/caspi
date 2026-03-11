from __future__ import annotations

from abc import ABC, abstractmethod

from caspi.domain.entities.sharing_rule import SharingRule
from caspi.domain.value_objects.ids import RuleId


class SharingRuleRepository(ABC):
    @abstractmethod
    async def save(self, rule: SharingRule) -> None: ...

    @abstractmethod
    async def find_by_id(self, rule_id: RuleId) -> SharingRule | None: ...

    @abstractmethod
    async def find_all(self) -> list[SharingRule]: ...

    @abstractmethod
    async def delete(self, rule_id: RuleId) -> None: ...
