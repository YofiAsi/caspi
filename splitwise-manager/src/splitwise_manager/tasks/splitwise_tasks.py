from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from splitwise_manager.domain.entities.splitwise_link import SplitwiseLink
from splitwise_manager.domain.value_objects.enums import (
    LinkStatus,
    OutboxOperation,
    OutboxStatus,
    SplitMethod,
)
from splitwise_manager.infrastructure.credentials_provider import client_for, resolve_creds
from splitwise_manager.infrastructure.database import async_session
from splitwise_manager.infrastructure.repositories import (
    SqlCredentialsRepository,
    SqlLinkRepository,
    SqlOutboxRepository,
)
from splitwise_manager.infrastructure.splitwise_client import SplitwiseAPIError
from splitwise_manager.settings import settings
from splitwise_manager.tasks.backoff import next_attempt_at
from splitwise_manager.tasks.celery_app import celery_app

log = logging.getLogger(__name__)


def _run(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():  # pragma: no cover
            raise RuntimeError("event loop is already running")
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return asyncio.get_event_loop().run_until_complete(coro)


async def _process_push(outbox_id: UUID) -> None:
    async with async_session() as session:
        outbox_repo = SqlOutboxRepository(session)
        link_repo = SqlLinkRepository(session)
        creds_repo = SqlCredentialsRepository(session)

        entry = await outbox_repo.get(outbox_id)
        if entry is None or entry.status not in (OutboxStatus.QUEUED, OutboxStatus.IN_PROGRESS):
            return
        entry.status = OutboxStatus.IN_PROGRESS
        await outbox_repo.update(entry)
        await session.commit()

        try:
            resolved = await resolve_creds(creds_repo.load)
            if resolved is None:
                raise SplitwiseAPIError("no credentials configured")
            current_user_id = resolved.splitwise_user_id
            client = client_for(resolved)
            if current_user_id is None:
                current_user_id = await client.validate()

            p = entry.payload
            created = await client.create_expense(
                group_id=int(p["group_id"]),
                cost=Decimal(str(p["amount"])),
                currency=str(p["currency"]),
                description=str(p.get("description", "")),
                date_iso=p.get("date"),
                split_method=SplitMethod(p["split_method"]),
                split_params=p.get("split_params") or {},
                current_user_id=int(current_user_id),
            )

            link = SplitwiseLink(
                payment_id=entry.payment_id,
                splitwise_group_id=int(p["group_id"]),
                status=LinkStatus.PUSHED,
                splitwise_expense_id=created.id,
                pushed_at=datetime.now(timezone.utc),
                last_error=None,
            )
            await link_repo.upsert(link)

            entry.status = OutboxStatus.SUCCEEDED
            entry.last_error = None
            await outbox_repo.update(entry)
            await session.commit()
        except Exception as e:
            await _record_failure(session, outbox_repo, link_repo, entry, e)


async def _process_delete(outbox_id: UUID) -> None:
    async with async_session() as session:
        outbox_repo = SqlOutboxRepository(session)
        link_repo = SqlLinkRepository(session)
        creds_repo = SqlCredentialsRepository(session)

        entry = await outbox_repo.get(outbox_id)
        if entry is None or entry.status not in (OutboxStatus.QUEUED, OutboxStatus.IN_PROGRESS):
            return
        entry.status = OutboxStatus.IN_PROGRESS
        await outbox_repo.update(entry)
        await session.commit()

        try:
            resolved = await resolve_creds(creds_repo.load)
            if resolved is None:
                raise SplitwiseAPIError("no credentials configured")
            client = client_for(resolved)
            expense_id = int(entry.payload["splitwise_expense_id"])
            await client.delete_expense(expense_id)

            if entry.payment_id is not None:
                existing = await link_repo.get(entry.payment_id)
                if existing is not None:
                    existing.status = LinkStatus.DELETED_REMOTE
                    await link_repo.upsert(existing)

            entry.status = OutboxStatus.SUCCEEDED
            entry.last_error = None
            await outbox_repo.update(entry)
            await session.commit()
        except Exception as e:
            await _record_failure(session, outbox_repo, link_repo, entry, e)


async def _record_failure(session, outbox_repo, link_repo, entry, exc: Exception) -> None:
    entry.attempts += 1
    entry.last_error = str(exc)[:2000]
    if entry.attempts >= settings.splitwise_retry_max_attempts:
        entry.status = OutboxStatus.FAILED
        entry.next_attempt_at = None
    else:
        entry.status = OutboxStatus.QUEUED
        entry.next_attempt_at = next_attempt_at(entry.attempts)
    await outbox_repo.update(entry)

    if entry.payment_id is not None and entry.operation == OutboxOperation.PUSH:
        existing = await link_repo.get(entry.payment_id)
        if existing is not None:
            existing.status = (
                LinkStatus.FAILED if entry.status == OutboxStatus.FAILED else LinkStatus.PENDING
            )
            existing.last_error = entry.last_error
            await link_repo.upsert(existing)
    await session.commit()


@celery_app.task(name="splitwise_manager.tasks.splitwise_tasks.push_payment")
def push_payment(outbox_id: str) -> None:
    _run(_process_push(UUID(outbox_id)))


@celery_app.task(name="splitwise_manager.tasks.splitwise_tasks.delete_expense")
def delete_expense(outbox_id: str) -> None:
    _run(_process_delete(UUID(outbox_id)))


@celery_app.task(name="splitwise_manager.tasks.splitwise_tasks.requeue_due_outbox")
def requeue_due_outbox() -> None:
    async def _go() -> None:
        async with async_session() as session:
            outbox_repo = SqlOutboxRepository(session)
            due = await outbox_repo.list_due(limit=100)
            await session.commit()
            for entry in due:
                if entry.operation == OutboxOperation.PUSH:
                    push_payment.delay(str(entry.id))
                else:
                    delete_expense.delay(str(entry.id))

    _run(_go())
