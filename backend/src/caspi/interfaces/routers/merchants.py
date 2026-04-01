from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.payments.update import PaymentPatchValidationError, _validate_tag_ids
from caspi.domain.value_objects.ids import MerchantId
from caspi.infrastructure.database import get_db
from caspi.infrastructure.models import MerchantModel
from caspi.infrastructure.repositories.merchant_repository import SqlMerchantRepository

router = APIRouter(prefix="/api/merchants", tags=["merchants"])


class MerchantResponse(BaseModel):
    id: str
    canonical_name: str
    alias: str | None
    tag_ids: list[str]


class PatchMerchantBody(BaseModel):
    alias: str | None = None
    tag_ids: list[str] | None = None


def _to_response(
    m: MerchantModel,
    tag_ids: list[UUID],
) -> MerchantResponse:
    return MerchantResponse(
        id=str(m.id),
        canonical_name=m.canonical_name,
        alias=m.alias,
        tag_ids=[str(t) for t in tag_ids],
    )


@router.get("", response_model=list[MerchantResponse])
async def list_merchants(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MerchantModel).order_by(MerchantModel.canonical_name))
    merchants = list(result.scalars().all())
    tag_map = await SqlMerchantRepository(db).load_tag_ids_by_merchant()
    return [_to_response(m, tag_map.get(m.id, [])) for m in merchants]


@router.get("/{merchant_id}", response_model=MerchantResponse)
async def get_merchant(merchant_id: str, db: AsyncSession = Depends(get_db)):
    try:
        mid = UUID(merchant_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid merchant_id") from None
    m = await db.get(MerchantModel, mid)
    if not m:
        raise HTTPException(status_code=404, detail="Merchant not found")
    tag_map = await SqlMerchantRepository(db).load_tag_ids_by_merchant()
    return _to_response(m, tag_map.get(m.id, []))


@router.patch("/{merchant_id}", response_model=MerchantResponse)
async def patch_merchant(merchant_id: str, body: PatchMerchantBody, db: AsyncSession = Depends(get_db)):
    try:
        mid = UUID(merchant_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid merchant_id") from None
    m = await db.get(MerchantModel, mid)
    if not m:
        raise HTTPException(status_code=404, detail="Merchant not found")
    repo = SqlMerchantRepository(db)
    if body.alias is not None:
        await repo.set_alias(MerchantId(mid), body.alias)
    if body.tag_ids is not None:
        tids = []
        for s in body.tag_ids:
            try:
                tids.append(UUID(s))
            except ValueError:
                raise HTTPException(status_code=422, detail="Invalid tag id") from None
        tids = list(dict.fromkeys(tids))
        try:
            await _validate_tag_ids(db, tids)
        except PaymentPatchValidationError as e:
            raise HTTPException(status_code=422, detail=str(e)) from e
        await repo.replace_tag_ids(MerchantId(mid), tids)
    await db.commit()
    await db.refresh(m)
    tag_map = await SqlMerchantRepository(db).load_tag_ids_by_merchant()
    return _to_response(m, tag_map.get(m.id, []))
