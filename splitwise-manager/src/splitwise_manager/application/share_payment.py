from __future__ import annotations

from dataclasses import dataclass
from datetime import date as date_t
from decimal import Decimal
from typing import Callable
from uuid import UUID

from splitwise_manager.domain.entities.splitwise_link import SplitwiseLink
from splitwise_manager.domain.entities.splitwise_outbox_entry import OutboxEntry
from splitwise_manager.domain.repositories.credentials import CredentialsRepository
from splitwise_manager.domain.repositories.links import LinkRepository
from splitwise_manager.domain.repositories.outbox import OutboxRepository
from splitwise_manager.domain.services.share_computation_service import compute_my_share
from splitwise_manager.domain.value_objects.enums import (
    LinkStatus,
    OutboxOperation,
    OutboxStatus,
    SplitMethod,
)
from splitwise_manager.domain.value_objects.share import Share
from splitwise_manager.infrastructure.credentials_provider import resolve_creds


@dataclass
class SharePaymentRequest:
    payment_id: UUID
    amount: Decimal
    currency: str
    group_id: int
    split_method: SplitMethod
    split_params: dict
    description: str = ""
    date: date_t | None = None


@dataclass
class SharePaymentResult:
    my_share_amount: Decimal
    my_share_currency: str
    outbox_id: UUID


async def share_payment(
    request: SharePaymentRequest,
    *,
    creds_repo: CredentialsRepository,
    link_repo: LinkRepository,
    outbox_repo: OutboxRepository,
    dispatch_push: Callable[[str], None] | None = None,
) -> SharePaymentResult:
    resolved = await resolve_creds(creds_repo.load)
    if resolved is None or resolved.splitwise_user_id is None:
        # If env creds are present but never validated, validate now to get the user id.
        if resolved is not None:
            from splitwise_manager.infrastructure.credentials_provider import client_for
            user_id = await client_for(resolved).validate()
        else:
            from splitwise_manager.infrastructure.splitwise_client import SplitwiseAPIError
            raise SplitwiseAPIError("splitwise is not connected")
    else:
        user_id = resolved.splitwise_user_id

    share: Share = compute_my_share(
        total=request.amount,
        currency=request.currency,
        method=request.split_method,
        params=request.split_params,
        current_user_id=int(user_id),
    )

    await link_repo.upsert(
        SplitwiseLink(
            payment_id=request.payment_id,
            splitwise_group_id=request.group_id,
            status=LinkStatus.PENDING,
        )
    )

    payload = {
        "group_id": request.group_id,
        "amount": str(request.amount),
        "currency": request.currency,
        "split_method": request.split_method.value,
        "split_params": request.split_params,
        "description": request.description,
        "date": request.date.isoformat() if request.date else None,
    }
    entry = OutboxEntry(
        operation=OutboxOperation.PUSH,
        payload=payload,
        payment_id=request.payment_id,
        status=OutboxStatus.QUEUED,
    )
    await outbox_repo.add(entry)

    if dispatch_push is not None:
        dispatch_push(str(entry.id))

    return SharePaymentResult(
        my_share_amount=share.amount,
        my_share_currency=share.currency,
        outbox_id=entry.id,
    )
