from __future__ import annotations

from dataclasses import dataclass

from caspi.domain.value_objects.ids import CategoryId


@dataclass
class Category:
    category_id: CategoryId
    name: str
    parent_id: CategoryId | None = None

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise ValueError("Category name must not be empty")

    def rename(self, name: str) -> None:
        if not name.strip():
            raise ValueError("Category name must not be empty")
        self.name = name
