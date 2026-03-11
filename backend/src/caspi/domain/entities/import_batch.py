from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from caspi.domain.value_objects.enums import PaymentSource
from caspi.domain.value_objects.ids import ImportId


@dataclass
class ImportBatch:
    import_id: ImportId
    source: PaymentSource
    file_name: str
    imported_at: datetime
    payment_count: int = 0

    def __post_init__(self) -> None:
        if not self.file_name.strip():
            raise ValueError("file_name must not be empty")
        if self.payment_count < 0:
            raise ValueError("payment_count cannot be negative")
