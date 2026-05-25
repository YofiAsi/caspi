from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.infrastructure.models import CollectionModel


async def create_collection(db: AsyncSession, name: str) -> tuple[UUID, str]:
    trimmed = name.strip()
    if not trimmed:
        raise ValueError("name must not be empty")
    c = CollectionModel(id=uuid4(), name=trimmed)
    db.add(c)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise ValueError("A collection with this name already exists") from None
    return c.id, c.name
