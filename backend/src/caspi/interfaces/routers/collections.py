from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.infrastructure.database import get_db
from caspi.infrastructure.models import CollectionModel

router = APIRouter(prefix="/api/collections", tags=["collections"])


class CollectionResponse(BaseModel):
    id: str
    name: str


class CreateCollectionBody(BaseModel):
    name: str


class PatchCollectionBody(BaseModel):
    name: str


@router.get("", response_model=list[CollectionResponse])
async def list_collections(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CollectionModel).order_by(CollectionModel.name))
    return [CollectionResponse(id=str(c.id), name=c.name) for c in result.scalars().all()]


@router.post("", response_model=CollectionResponse, status_code=201)
async def create_collection(body: CreateCollectionBody, db: AsyncSession = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="name must not be empty")
    c = CollectionModel(id=uuid4(), name=name)
    db.add(c)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="A collection with this name already exists") from None
    await db.refresh(c)
    return CollectionResponse(id=str(c.id), name=c.name)


@router.patch("/{collection_id}", response_model=CollectionResponse)
async def patch_collection(collection_id: str, body: PatchCollectionBody, db: AsyncSession = Depends(get_db)):
    try:
        cid = UUID(collection_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid collection_id") from None
    c = await db.get(CollectionModel, cid)
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")
    new_name = body.name.strip()
    if not new_name:
        raise HTTPException(status_code=422, detail="name must not be empty")
    c.name = new_name
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="A collection with this name already exists") from None
    await db.refresh(c)
    return CollectionResponse(id=str(c.id), name=c.name)
