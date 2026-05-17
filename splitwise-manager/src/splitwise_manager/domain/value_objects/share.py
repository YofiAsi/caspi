from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class Share:
    amount: Decimal
    currency: str

    def __post_init__(self) -> None:
        if self.amount < 0:
            raise ValueError("share amount must not be negative")
        if not self.currency or len(self.currency) != 3:
            raise ValueError("currency must be a 3-letter code")
