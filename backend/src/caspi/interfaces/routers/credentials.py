from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.infrastructure.database import get_db
from caspi.infrastructure.models import ScraperCredentialModel
from caspi.interfaces.dependencies import get_user_id
from caspi.interfaces.schemas import CredentialCreate, CredentialOut, CredentialUpdate
from caspi.services.credential_service import encrypt_credentials

router = APIRouter(prefix="/api/credentials", tags=["credentials"])


def _cred_out(c: ScraperCredentialModel) -> CredentialOut:
    return CredentialOut(
        id=c.id, provider=c.provider, label=c.label,
        created_at=c.created_at, updated_at=c.updated_at,
    )


@router.get("", response_model=list[CredentialOut])
async def list_credentials(user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ScraperCredentialModel).where(ScraperCredentialModel.user_id == user_id)
        .order_by(ScraperCredentialModel.provider, ScraperCredentialModel.label)
    )
    return [_cred_out(c) for c in result.scalars()]


@router.post("", response_model=CredentialOut, status_code=201)
async def create_credential(
    body: CredentialCreate,
    user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db),
):
    cred = ScraperCredentialModel(
        id=uuid.uuid4(),
        user_id=user_id,
        provider=body.provider,
        label=body.label.strip(),
        encrypted_credentials=encrypt_credentials(body.credentials),
    )
    db.add(cred)
    await db.commit()
    await db.refresh(cred)
    return _cred_out(cred)


@router.put("/{credential_id}", response_model=CredentialOut)
async def update_credential(
    credential_id: uuid.UUID, body: CredentialUpdate,
    user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ScraperCredentialModel)
        .where(ScraperCredentialModel.id == credential_id, ScraperCredentialModel.user_id == user_id)
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(404)
    if body.label is not None:
        cred.label = body.label.strip()
    if body.credentials is not None:
        cred.encrypted_credentials = encrypt_credentials(body.credentials)
    await db.commit()
    await db.refresh(cred)
    return _cred_out(cred)


@router.delete("/{credential_id}", status_code=204)
async def delete_credential(
    credential_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ScraperCredentialModel)
        .where(ScraperCredentialModel.id == credential_id, ScraperCredentialModel.user_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404)
    await db.execute(delete(ScraperCredentialModel).where(ScraperCredentialModel.id == credential_id))
    await db.commit()
