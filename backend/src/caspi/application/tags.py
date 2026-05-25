from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.domain.value_objects.tag import Tag
from caspi.infrastructure.models import TagModel


async def create_tag(db: AsyncSession, name: str) -> tuple[UUID, str]:
    normalized = Tag(name).name
    existing = await db.execute(select(TagModel).where(TagModel.name == normalized))
    row = existing.scalar_one_or_none()
    if row:
        return row.id, row.name
    t = TagModel(id=uuid4(), name=normalized)
    db.add(t)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        existing = await db.execute(select(TagModel).where(TagModel.name == normalized))
        row = existing.scalar_one()
        return row.id, row.name
    return t.id, t.name
