from __future__ import annotations

from abc import ABC, abstractmethod

from caspi.domain.entities.import_batch import ImportBatch
from caspi.domain.value_objects.ids import ImportId


class ImportBatchRepository(ABC):
    @abstractmethod
    async def save(self, import_batch: ImportBatch) -> None: ...

    @abstractmethod
    async def find_by_id(self, import_id: ImportId) -> ImportBatch | None: ...

    @abstractmethod
    async def find_all(self) -> list[ImportBatch]: ...
