from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Tag:
    name: str

    def __init__(self, name: str) -> None:
        object.__setattr__(self, "name", name.strip().lower())
        if not self.name:
            raise ValueError("Tag name must not be empty")
