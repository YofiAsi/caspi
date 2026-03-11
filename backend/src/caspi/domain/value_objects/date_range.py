from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class DateRange:
    start: date
    end: date

    def __post_init__(self) -> None:
        if self.start > self.end:
            raise ValueError("DateRange start must not be after end")

    def contains(self, d: date) -> bool:
        return self.start <= d <= self.end
