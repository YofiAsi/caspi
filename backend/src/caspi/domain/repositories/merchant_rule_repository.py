from __future__ import annotations

from abc import ABC, abstractmethod

from caspi.domain.entities.merchant_rule import MerchantRule
from caspi.domain.value_objects.ids import RuleId


class MerchantRuleRepository(ABC):
    @abstractmethod
    async def save(self, rule: MerchantRule) -> None: ...

    @abstractmethod
    async def find_by_id(self, rule_id: RuleId) -> MerchantRule | None: ...

    @abstractmethod
    async def find_by_merchant_key(self, merchant_key: str) -> MerchantRule | None: ...

    @abstractmethod
    async def find_all(self) -> list[MerchantRule]: ...

    @abstractmethod
    async def delete(self, rule_id: RuleId) -> None: ...
