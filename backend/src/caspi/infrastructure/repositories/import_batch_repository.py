import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.domain.entities import ImportBatch
from caspi.domain.repositories import ImportBatchRepository
from caspi.domain.value_objects import ImportId, PaymentSource
from caspi.infrastructure.models import ImportBatchModel


def _to_domain(model: ImportBatchModel) -> ImportBatch:
    return ImportBatch(
        import_id=ImportId(model.import_id),
        source=PaymentSource(model.source),
        file_name=model.file_name,
        imported_at=model.imported_at,
        payment_count=model.payment_count,
    )


def _to_orm(batch: ImportBatch) -> ImportBatchModel:
    return ImportBatchModel(
        import_id=batch.import_id.value,
        source=batch.source.value,
        file_name=batch.file_name,
        imported_at=batch.imported_at,
        payment_count=batch.payment_count,
    )


class SqlImportBatchRepository(ImportBatchRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, import_batch: ImportBatch) -> None:
        existing = await self._session.get(ImportBatchModel, import_batch.import_id.value)
        if existing:
            existing.source = import_batch.source.value
            existing.file_name = import_batch.file_name
            existing.imported_at = import_batch.imported_at
            existing.payment_count = import_batch.payment_count
        else:
            self._session.add(_to_orm(import_batch))

    async def find_by_id(self, import_id: ImportId) -> ImportBatch | None:
        model = await self._session.get(ImportBatchModel, import_id.value)
        return _to_domain(model) if model else None

    async def find_all(self) -> list[ImportBatch]:
        result = await self._session.execute(select(ImportBatchModel))
        return [_to_domain(m) for m in result.scalars().all()]
