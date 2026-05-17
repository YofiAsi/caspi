from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from splitwise_manager.api.schemas import (
    ApplyRuleBody,
    ApplyRuleResponse,
    ConnectRequestBody,
    ConnectResponse,
    FailedListResponse,
    GroupMemberSchema,
    GroupSchema,
    GroupsResponse,
    OutboxEntryResponse,
    RetryResponse,
    RuleBody,
    RuleResponse,
    ShareRequestBody,
    ShareResponse,
    StatusResponse,
    UnshareResponse,
)
from splitwise_manager.application.apply_rule import ApplyRuleRequest, apply_rule
from splitwise_manager.application.connect import ConnectRequest, connect
from splitwise_manager.application.disconnect import disconnect
from splitwise_manager.application.get_status import get_status
from splitwise_manager.application.list_failed import list_failed
from splitwise_manager.application.list_groups import list_groups
from splitwise_manager.application.merchant_rules import (
    UpsertRuleRequest,
    delete_rule,
    get_rule,
    upsert_rule,
)
from splitwise_manager.application.retry import retry_payment
from splitwise_manager.application.share_payment import SharePaymentRequest, share_payment
from splitwise_manager.application.unshare_payment import unshare_payment
from splitwise_manager.infrastructure.database import get_db
from splitwise_manager.infrastructure.repositories import (
    SqlCredentialsRepository,
    SqlLinkRepository,
    SqlMerchantRuleRepository,
    SqlOutboxRepository,
)
from splitwise_manager.infrastructure.crypto import CryptoError
from splitwise_manager.infrastructure.splitwise_client import SplitwiseAPIError

log = logging.getLogger(__name__)

router = APIRouter()


def _dispatch_push(outbox_id: str) -> None:
    from splitwise_manager.tasks.splitwise_tasks import push_payment

    push_payment.delay(outbox_id)


def _dispatch_delete(outbox_id: str) -> None:
    from splitwise_manager.tasks.splitwise_tasks import delete_expense

    delete_expense.delay(outbox_id)


@router.get("/status", response_model=StatusResponse)
async def status_endpoint(session: AsyncSession = Depends(get_db)) -> StatusResponse:
    result = await get_status(
        creds_repo=SqlCredentialsRepository(session),
        outbox_repo=SqlOutboxRepository(session),
    )
    return StatusResponse(
        connected=result.connected,
        source=result.source,
        splitwise_user_id=result.splitwise_user_id,
        last_validated_at=result.last_validated_at_iso,
        queued=result.queued,
        failed=result.failed,
    )


@router.post("/connect", response_model=ConnectResponse)
async def connect_endpoint(
    body: ConnectRequestBody, session: AsyncSession = Depends(get_db)
) -> ConnectResponse:
    try:
        result = await connect(
            ConnectRequest(
                consumer_key=body.consumer_key,
                consumer_secret=body.consumer_secret,
                api_key=body.api_key,
            ),
            creds_repo=SqlCredentialsRepository(session),
        )
        await session.commit()
    except CryptoError as e:
        log.error("connect failed (encryption): %s", e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except SplitwiseAPIError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return ConnectResponse(source=result.source, splitwise_user_id=result.splitwise_user_id)


@router.post("/disconnect", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_endpoint(session: AsyncSession = Depends(get_db)) -> None:
    await disconnect(creds_repo=SqlCredentialsRepository(session))
    await session.commit()


@router.get("/groups", response_model=GroupsResponse)
async def groups_endpoint(session: AsyncSession = Depends(get_db)) -> GroupsResponse:
    try:
        groups = await list_groups(creds_repo=SqlCredentialsRepository(session))
    except SplitwiseAPIError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return GroupsResponse(
        groups=[
            GroupSchema(
                id=g.id,
                name=g.name,
                members=[
                    GroupMemberSchema(
                        user_id=m.user_id,
                        first_name=m.first_name,
                        last_name=m.last_name,
                    )
                    for m in g.members
                ],
            )
            for g in groups
        ]
    )


@router.post("/share", response_model=ShareResponse)
async def share_endpoint(
    body: ShareRequestBody, session: AsyncSession = Depends(get_db)
) -> ShareResponse:
    try:
        result = await share_payment(
            SharePaymentRequest(
                payment_id=body.payment_id,
                amount=body.amount,
                currency=body.currency,
                group_id=body.group_id,
                split_method=body.split_method,
                split_params=body.split_params,
                description=body.description,
                date=body.date,
            ),
            creds_repo=SqlCredentialsRepository(session),
            link_repo=SqlLinkRepository(session),
            outbox_repo=SqlOutboxRepository(session),
            dispatch_push=_dispatch_push,
        )
        await session.commit()
    except SplitwiseAPIError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return ShareResponse(
        my_share_amount=result.my_share_amount,
        my_share_currency=result.my_share_currency,
        outbox_id=result.outbox_id,
    )


@router.delete("/share/{payment_id}", response_model=UnshareResponse)
async def unshare_endpoint(
    payment_id: UUID,
    delete_remote: bool = Query(False),
    session: AsyncSession = Depends(get_db),
) -> UnshareResponse:
    result = await unshare_payment(
        payment_id=payment_id,
        delete_remote=delete_remote,
        link_repo=SqlLinkRepository(session),
        outbox_repo=SqlOutboxRepository(session),
        dispatch_delete=_dispatch_delete,
    )
    await session.commit()
    return UnshareResponse(delete_enqueued=result.delete_enqueued, outbox_id=result.outbox_id)


def _rule_to_response(rule) -> RuleResponse:
    return RuleResponse(
        merchant_id=rule.merchant_id,
        enabled=rule.enabled,
        splitwise_group_id=rule.splitwise_group_id,
        split_method=rule.split_method,
        split_params=rule.split_params,
        currency=rule.currency,
    )


@router.get("/rules/{merchant_id}", response_model=RuleResponse)
async def get_rule_endpoint(
    merchant_id: UUID, session: AsyncSession = Depends(get_db)
) -> RuleResponse:
    rule = await get_rule(merchant_id, rule_repo=SqlMerchantRuleRepository(session))
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="rule not found")
    return _rule_to_response(rule)


@router.put("/rules/{merchant_id}", response_model=RuleResponse)
async def put_rule_endpoint(
    merchant_id: UUID, body: RuleBody, session: AsyncSession = Depends(get_db)
) -> RuleResponse:
    rule = await upsert_rule(
        UpsertRuleRequest(
            merchant_id=merchant_id,
            enabled=body.enabled,
            splitwise_group_id=body.splitwise_group_id,
            split_method=body.split_method,
            split_params=body.split_params,
            currency=body.currency,
        ),
        rule_repo=SqlMerchantRuleRepository(session),
    )
    await session.commit()
    return _rule_to_response(rule)


@router.delete("/rules/{merchant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule_endpoint(
    merchant_id: UUID, session: AsyncSession = Depends(get_db)
) -> None:
    await delete_rule(merchant_id, rule_repo=SqlMerchantRuleRepository(session))
    await session.commit()


@router.post("/rules/apply", response_model=ApplyRuleResponse)
async def apply_rule_endpoint(
    body: ApplyRuleBody, session: AsyncSession = Depends(get_db)
) -> ApplyRuleResponse:
    try:
        result = await apply_rule(
            ApplyRuleRequest(
                payment_id=body.payment_id,
                merchant_id=body.merchant_id,
                amount=body.amount,
                currency=body.currency,
                description=body.description,
                date=body.date,
            ),
            rule_repo=SqlMerchantRuleRepository(session),
            creds_repo=SqlCredentialsRepository(session),
            link_repo=SqlLinkRepository(session),
            outbox_repo=SqlOutboxRepository(session),
            dispatch_push=_dispatch_push,
        )
        await session.commit()
    except SplitwiseAPIError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return ApplyRuleResponse(
        shared=result.shared,
        my_share_amount=result.my_share_amount,
        my_share_currency=result.my_share_currency,
    )


def _outbox_to_response(entry) -> OutboxEntryResponse:
    return OutboxEntryResponse(
        id=entry.id,
        payment_id=entry.payment_id,
        operation=entry.operation.value,
        status=entry.status.value,
        attempts=entry.attempts,
        last_error=entry.last_error,
        next_attempt_at=entry.next_attempt_at.isoformat() if entry.next_attempt_at else None,
        created_at=entry.created_at.isoformat() if entry.created_at else None,
        updated_at=entry.updated_at.isoformat() if entry.updated_at else None,
    )


@router.get("/outbox/failed", response_model=FailedListResponse)
async def list_failed_endpoint(
    limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_db),
) -> FailedListResponse:
    entries = await list_failed(outbox_repo=SqlOutboxRepository(session), limit=limit)
    return FailedListResponse(entries=[_outbox_to_response(e) for e in entries])


@router.post("/retry/{payment_id}", response_model=RetryResponse)
async def retry_endpoint(
    payment_id: UUID, session: AsyncSession = Depends(get_db)
) -> RetryResponse:
    result = await retry_payment(
        payment_id,
        outbox_repo=SqlOutboxRepository(session),
        dispatch_push=_dispatch_push,
        dispatch_delete=_dispatch_delete,
    )
    await session.commit()
    return RetryResponse(outbox_id=result.outbox_id, requeued=result.requeued)
