from __future__ import annotations

from abc import ABC, abstractmethod

from caspi.domain.entities.payment import Payment
from caspi.domain.value_objects.date_range import DateRange
from caspi.domain.value_objects.enums import PaymentSource
from caspi.domain.value_objects.ids import CategoryId, ImportId, PaymentId
from caspi.domain.value_objects.tag import Tag


class PaymentRepository(ABC):
    @abstractmethod
    async def save(self, payment: Payment) -> None: ...

    @abstractmethod
    async def find_by_id(self, payment_id: PaymentId) -> Payment | None: ...

    @abstractmethod
    async def find_by_date_range(self, date_range: DateRange) -> list[Payment]: ...

    @abstractmethod
    async def find_by_category(self, category_id: CategoryId) -> list[Payment]: ...

    @abstractmethod
    async def find_by_import(self, import_id: ImportId) -> list[Payment]: ...

    @abstractmethod
    async def find_by_tag(self, tag: Tag) -> list[Payment]: ...

    @abstractmethod
    async def find_uncategorized(self) -> list[Payment]: ...

    @abstractmethod
    async def find_source_identifiers(self, source: PaymentSource) -> set[str]: ...
