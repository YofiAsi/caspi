from __future__ import annotations

from abc import ABC, abstractmethod

from caspi.domain.value_objects.tag import Tag


class TagRepository(ABC):
    @abstractmethod
    async def save(self, tag: Tag) -> None: ...

    @abstractmethod
    async def find_all(self) -> list[Tag]: ...
