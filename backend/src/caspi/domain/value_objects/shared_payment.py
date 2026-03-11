from __future__ import annotations

from dataclasses import dataclass

from caspi.domain.value_objects.money import Money


@dataclass(frozen=True)
class SharedPayment:
    my_share: Money

    def __post_init__(self) -> None:
        if self.my_share.amount <= 0:
            raise ValueError("my_share must be greater than zero")
