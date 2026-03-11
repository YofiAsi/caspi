from __future__ import annotations

from abc import ABC, abstractmethod

from caspi.domain.entities.category import Category
from caspi.domain.value_objects.ids import CategoryId


class CategoryRepository(ABC):
    @abstractmethod
    async def save(self, category: Category) -> None: ...

    @abstractmethod
    async def find_by_id(self, category_id: CategoryId) -> Category | None: ...

    @abstractmethod
    async def find_all(self) -> list[Category]: ...
