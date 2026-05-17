from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Body, HTTPException, Query, status
from pydantic import BaseModel

from caspi.infrastructure.splitwise_manager_client import (
    SplitwiseManagerClient,
    SplitwiseManagerError,
    SplitwiseManagerUnavailable,
)
from caspi.settings import settings

router = APIRouter(prefix="/api/splitwise", tags=["splitwise"])


def _client() -> SplitwiseManagerClient:
    return SplitwiseManagerClient(settings.splitwise_manager_url)


def _handle(exc: Exception) -> HTTPException:
    if isinstance(exc, SplitwiseManagerUnavailable):
        return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    if isinstance(exc, SplitwiseManagerError):
        return HTTPException(status_code=exc.status_code, detail=exc.detail)
    return HTTPException(status_code=500, detail=str(exc))


@router.get("/status")
async def get_status() -> dict:
    try:
        return await _client().get_status()
    except (SplitwiseManagerUnavailable, SplitwiseManagerError) as e:
        raise _handle(e)


@router.post("/connect")
async def post_connect(body: dict = Body(default_factory=dict)) -> dict:
    try:
        return await _client().connect(
            consumer_key=body.get("consumer_key"),
            consumer_secret=body.get("consumer_secret"),
            api_key=body.get("api_key"),
        )
    except (SplitwiseManagerUnavailable, SplitwiseManagerError) as e:
        raise _handle(e)


@router.post("/disconnect", status_code=status.HTTP_204_NO_CONTENT)
async def post_disconnect() -> None:
    try:
        await _client().disconnect()
    except (SplitwiseManagerUnavailable, SplitwiseManagerError) as e:
        raise _handle(e)


@router.get("/groups")
async def get_groups() -> dict:
    try:
        return await _client().list_groups()
    except (SplitwiseManagerUnavailable, SplitwiseManagerError) as e:
        raise _handle(e)


@router.post("/share")
async def post_share(body: dict) -> dict:
    try:
        return await _client().share(body)
    except (SplitwiseManagerUnavailable, SplitwiseManagerError) as e:
        raise _handle(e)


@router.delete("/share/{payment_id}")
async def delete_share(payment_id: UUID, delete_remote: bool = Query(False)) -> dict:
    try:
        return await _client().unshare(payment_id, delete_remote=delete_remote)
    except (SplitwiseManagerUnavailable, SplitwiseManagerError) as e:
        raise _handle(e)


@router.get("/rules/{merchant_id}")
async def get_rule(merchant_id: UUID) -> dict:
    try:
        rule = await _client().get_rule(merchant_id)
    except (SplitwiseManagerUnavailable, SplitwiseManagerError) as e:
        raise _handle(e)
    if rule is None:
        raise HTTPException(status_code=404, detail="rule not found")
    return rule


@router.put("/rules/{merchant_id}")
async def put_rule(merchant_id: UUID, body: dict) -> dict:
    try:
        return await _client().put_rule(merchant_id, body)
    except (SplitwiseManagerUnavailable, SplitwiseManagerError) as e:
        raise _handle(e)


@router.delete("/rules/{merchant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(merchant_id: UUID) -> None:
    try:
        await _client().delete_rule(merchant_id)
    except (SplitwiseManagerUnavailable, SplitwiseManagerError) as e:
        raise _handle(e)


@router.get("/outbox/failed")
async def get_failed(limit: int = Query(100, ge=1, le=500)) -> dict:
    try:
        return await _client().list_failed(limit=limit)
    except (SplitwiseManagerUnavailable, SplitwiseManagerError) as e:
        raise _handle(e)


@router.post("/retry/{payment_id}")
async def post_retry(payment_id: UUID) -> dict:
    try:
        return await _client().retry(payment_id)
    except (SplitwiseManagerUnavailable, SplitwiseManagerError) as e:
        raise _handle(e)
