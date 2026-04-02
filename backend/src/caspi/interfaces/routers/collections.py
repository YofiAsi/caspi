from datetime import date
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.collections.stats import list_collections_with_stats
from caspi.application.payments.read import collection_tag_slices, collection_timeseries
from caspi.infrastructure.database import get_db
from caspi.infrastructure.models import CollectionModel
from caspi.interfaces.schemas.payments import MonthTagSlicesResponse

router = APIRouter(prefix="/api/collections", tags=["collections"])


class CollectionWithStatsResponse(BaseModel):
    id: str
    name: str
    payment_count: int
    sum_effective: Decimal
    first_payment_date: date | None = None
    last_payment_date: date | None = None


class CreateCollectionBody(BaseModel):
    name: str


class PatchCollectionBody(BaseModel):
    name: str


class TimeseriesGranularity(str, Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"


class CollectionTimeseriesRow(BaseModel):
    period_start: date
    sum_effective: Decimal
    payment_count: int


class CollectionTimeseriesResponse(BaseModel):
    granularity: str
    rows: list[CollectionTimeseriesRow]


@router.get("", response_model=list[CollectionWithStatsResponse])
async def list_collections(db: AsyncSession = Depends(get_db)):
    rows = await list_collections_with_stats(db)
    return [
        CollectionWithStatsResponse(
            id=str(r[0]),
            name=r[1],
            payment_count=r[2],
            sum_effective=r[3],
            first_payment_date=r[4],
            last_payment_date=r[5],
        )
        for r in rows
    ]


@router.post("", response_model=CollectionWithStatsResponse, status_code=201)
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
    return CollectionWithStatsResponse(
        id=str(c.id),
        name=c.name,
        payment_count=0,
        sum_effective=Decimal(0),
        first_payment_date=None,
        last_payment_date=None,
    )


@router.get("/{collection_id}/tag-slices", response_model=MonthTagSlicesResponse)
async def get_collection_tag_slices(collection_id: str, db: AsyncSession = Depends(get_db)):
    try:
        cid = UUID(collection_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid collection_id") from None
    c = await db.get(CollectionModel, cid)
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")
    return await collection_tag_slices(db, collection_id=cid)


@router.get("/{collection_id}/timeseries", response_model=CollectionTimeseriesResponse)
async def get_collection_timeseries(
    collection_id: str,
    granularity: TimeseriesGranularity = Query(default=TimeseriesGranularity.monthly),
    db: AsyncSession = Depends(get_db),
):
    try:
        cid = UUID(collection_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid collection_id") from None
    c = await db.get(CollectionModel, cid)
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")
    raw = await collection_timeseries(db, collection_id=cid, granularity=granularity.value)
    return CollectionTimeseriesResponse(
        granularity=granularity.value,
        rows=[
            CollectionTimeseriesRow(
                period_start=d,
                sum_effective=s,
                payment_count=n,
            )
            for d, s, n in raw
        ],
    )


@router.patch("/{collection_id}", response_model=CollectionWithStatsResponse)
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
    rows = await list_collections_with_stats(db)
    for r in rows:
        if r[0] == cid:
            return CollectionWithStatsResponse(
                id=str(r[0]),
                name=r[1],
                payment_count=r[2],
                sum_effective=r[3],
                first_payment_date=r[4],
                last_payment_date=r[5],
            )
    return CollectionWithStatsResponse(
        id=str(c.id),
        name=c.name,
        payment_count=0,
        sum_effective=Decimal(0),
        first_payment_date=None,
        last_payment_date=None,
    )
