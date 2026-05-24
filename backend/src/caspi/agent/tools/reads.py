from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.collections.stats import list_collections_with_stats
from caspi.application.payments.read import (
    list_payments_page,
    payment_summary_for_filters,
    payment_timeseries,
)
from caspi.infrastructure.models import MerchantModel
from caspi.infrastructure.repositories.merchant_repository import SqlMerchantRepository
from caspi.infrastructure.splitwise_manager_client import (
    SplitwiseManagerClient,
    SplitwiseManagerError,
    SplitwiseManagerUnavailable,
)
from caspi.agent.tools.registry import ToolSpec, register_tool
from caspi.settings import settings
from sqlalchemy import select


def _parse_date(s: str | None) -> date | None:
    if not s:
        return None
    return date.fromisoformat(s)


def _parse_uuid(s: str) -> UUID:
    return UUID(s)


async def _list_payments(db: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    limit = min(int(args.get("limit", 50)), 50)
    page = await list_payments_page(
        db,
        include_tags=args.get("include_tags"),
        exclude_tags=args.get("exclude_tags"),
        date_from=_parse_date(args.get("date_from")),
        date_to=_parse_date(args.get("date_to")),
        amount_min=Decimal(str(args["amount_min"])) if args.get("amount_min") is not None else None,
        amount_max=Decimal(str(args["amount_max"])) if args.get("amount_max") is not None else None,
        tagged_only=args.get("tagged_only"),
        search_q=args.get("search_q"),
        currency=args.get("currency"),
        collection_id=_parse_uuid(args["collection_id"]) if args.get("collection_id") else None,
        limit=limit,
    )
    return page.model_dump(mode="json")


async def _payment_summary(db: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    summary = await payment_summary_for_filters(
        db,
        include_tags=args.get("include_tags"),
        exclude_tags=args.get("exclude_tags"),
        date_from=_parse_date(args.get("date_from")),
        date_to=_parse_date(args.get("date_to")),
        amount_min=Decimal(str(args["amount_min"])) if args.get("amount_min") is not None else None,
        amount_max=Decimal(str(args["amount_max"])) if args.get("amount_max") is not None else None,
        tagged_only=args.get("tagged_only"),
        collection_id=_parse_uuid(args["collection_id"]) if args.get("collection_id") else None,
    )
    return summary.model_dump(mode="json")


async def _payment_timeseries(db: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    granularity = args.get("granularity", "monthly")
    rows = await payment_timeseries(
        db,
        granularity=granularity,
        include_tags=args.get("include_tags"),
        exclude_tags=args.get("exclude_tags"),
        date_from=_parse_date(args.get("date_from")),
        date_to=_parse_date(args.get("date_to")),
        currency=args.get("currency"),
        collection_id=_parse_uuid(args["collection_id"]) if args.get("collection_id") else None,
    )
    return {
        "granularity": granularity,
        "rows": [
            {"period_start": d.isoformat(), "sum_effective": str(s), "payment_count": n}
            for d, s, n in rows
        ],
    }


async def _list_tags(db: AsyncSession, _args: dict[str, Any]) -> dict[str, Any]:
    from caspi.infrastructure.repositories.tag_query_repository import SqlTagQueryRepository

    rows = await SqlTagQueryRepository(db).list_all()
    return {"tags": [{"id": str(i), "name": n} for i, n in rows]}


async def _list_collections(db: AsyncSession, _args: dict[str, Any]) -> dict[str, Any]:
    rows = await list_collections_with_stats(db)
    return {
        "collections": [
            {
                "id": str(r[0]),
                "name": r[1],
                "payment_count": r[2],
                "sum_effective": str(r[3]),
                "first_payment_date": r[4].isoformat() if r[4] else None,
                "last_payment_date": r[5].isoformat() if r[5] else None,
            }
            for r in rows
        ]
    }


async def _list_merchants(db: AsyncSession, _args: dict[str, Any]) -> dict[str, Any]:
    result = await db.execute(select(MerchantModel).order_by(MerchantModel.canonical_name))
    merchants = list(result.scalars().all())
    tag_map = await SqlMerchantRepository(db).load_tag_ids_by_merchant()
    return {
        "merchants": [
            {
                "id": str(m.id),
                "canonical_name": m.canonical_name,
                "alias": m.alias,
                "tag_ids": [str(t) for t in tag_map.get(m.id, [])],
            }
            for m in merchants
        ]
    }


async def _get_merchant(db: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    mid = _parse_uuid(args["merchant_id"])
    m = await db.get(MerchantModel, mid)
    if not m:
        return {"error": "Merchant not found"}
    tag_map = await SqlMerchantRepository(db).load_tag_ids_by_merchant()
    return {
        "id": str(m.id),
        "canonical_name": m.canonical_name,
        "alias": m.alias,
        "tag_ids": [str(t) for t in tag_map.get(m.id, [])],
    }


async def _get_splitwise_rule(db: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    client = SplitwiseManagerClient(settings.splitwise_manager_url)
    if not client.configured:
        return {"error": "Splitwise not configured"}
    try:
        rule = await client.get_rule(_parse_uuid(args["merchant_id"]))
    except SplitwiseManagerUnavailable as e:
        return {"error": str(e)}
    except SplitwiseManagerError as e:
        return {"error": e.detail}
    if rule is None:
        return {"rule": None}
    return {"rule": rule}


async def _list_splitwise_groups(db: AsyncSession, _args: dict[str, Any]) -> dict[str, Any]:
    client = SplitwiseManagerClient(settings.splitwise_manager_url)
    if not client.configured:
        return {"error": "Splitwise not configured"}
    try:
        return await client.list_groups()
    except (SplitwiseManagerUnavailable, SplitwiseManagerError) as e:
        return {"error": str(e)}


def _register_reads() -> None:
    register_tool(
        ToolSpec(
            name="list_payments",
            description="List payments with optional filters. Returns at most 50 rows.",
            parameters={
                "type": "object",
                "properties": {
                    "include_tags": {"type": "array", "items": {"type": "string"}},
                    "exclude_tags": {"type": "array", "items": {"type": "string"}},
                    "date_from": {"type": "string", "description": "ISO date YYYY-MM-DD"},
                    "date_to": {"type": "string", "description": "ISO date YYYY-MM-DD"},
                    "amount_min": {"type": "number"},
                    "amount_max": {"type": "number"},
                    "tagged_only": {"type": "boolean"},
                    "search_q": {"type": "string"},
                    "currency": {"type": "string"},
                    "collection_id": {"type": "string"},
                    "limit": {"type": "integer", "maximum": 50},
                },
            },
            is_write=False,
            handler=_list_payments,
        )
    )
    register_tool(
        ToolSpec(
            name="payment_summary",
            description="Aggregate payment totals, tags, merchants for filters.",
            parameters={
                "type": "object",
                "properties": {
                    "include_tags": {"type": "array", "items": {"type": "string"}},
                    "exclude_tags": {"type": "array", "items": {"type": "string"}},
                    "date_from": {"type": "string"},
                    "date_to": {"type": "string"},
                    "amount_min": {"type": "number"},
                    "amount_max": {"type": "number"},
                    "tagged_only": {"type": "boolean"},
                    "collection_id": {"type": "string"},
                },
            },
            is_write=False,
            handler=_payment_summary,
        )
    )
    register_tool(
        ToolSpec(
            name="payment_timeseries",
            description="Time-bucketed spend for filters.",
            parameters={
                "type": "object",
                "properties": {
                    "granularity": {
                        "type": "string",
                        "enum": ["weekly", "monthly", "quarterly", "yearly"],
                    },
                    "include_tags": {"type": "array", "items": {"type": "string"}},
                    "exclude_tags": {"type": "array", "items": {"type": "string"}},
                    "date_from": {"type": "string"},
                    "date_to": {"type": "string"},
                    "currency": {"type": "string"},
                    "collection_id": {"type": "string"},
                },
            },
            is_write=False,
            handler=_payment_timeseries,
        )
    )
    register_tool(
        ToolSpec(
            name="list_tags",
            description="List all expense tags.",
            parameters={"type": "object", "properties": {}},
            is_write=False,
            handler=_list_tags,
        )
    )
    register_tool(
        ToolSpec(
            name="list_collections",
            description="List collections with stats.",
            parameters={"type": "object", "properties": {}},
            is_write=False,
            handler=_list_collections,
        )
    )
    register_tool(
        ToolSpec(
            name="list_merchants",
            description="List all merchants.",
            parameters={"type": "object", "properties": {}},
            is_write=False,
            handler=_list_merchants,
        )
    )
    register_tool(
        ToolSpec(
            name="get_merchant",
            description="Get one merchant by id.",
            parameters={
                "type": "object",
                "properties": {"merchant_id": {"type": "string"}},
                "required": ["merchant_id"],
            },
            is_write=False,
            handler=_get_merchant,
        )
    )
    register_tool(
        ToolSpec(
            name="get_splitwise_rule",
            description="Get Splitwise auto-share rule for a merchant.",
            parameters={
                "type": "object",
                "properties": {"merchant_id": {"type": "string"}},
                "required": ["merchant_id"],
            },
            is_write=False,
            handler=_get_splitwise_rule,
        )
    )
    register_tool(
        ToolSpec(
            name="list_splitwise_groups",
            description="List Splitwise groups for rule setup.",
            parameters={"type": "object", "properties": {}},
            is_write=False,
            handler=_list_splitwise_groups,
        )
    )


_register_reads()
