from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.collections_ops import create_collection as app_create_collection
from caspi.application.payments.update import PaymentPatchValidationError, apply_payment_patch
from caspi.application.tags import create_tag as app_create_tag
from caspi.domain.value_objects.ids import PaymentId
from caspi.domain.value_objects.tag import Tag
from caspi.infrastructure.models import CollectionModel, MerchantModel, PaymentModel, TagModel
from caspi.infrastructure.repositories.payment_repository import SqlPaymentRepository
from caspi.infrastructure.splitwise_manager_client import (
    SplitwiseManagerClient,
    SplitwiseManagerError,
    SplitwiseManagerUnavailable,
)
from caspi.agent.tools.registry import ToolSpec, register_tool
from caspi.interfaces.schemas.payments import PatchPaymentBody
from caspi.settings import settings


async def _tag_name(db: AsyncSession, tag_id: UUID) -> str:
    row = await db.get(TagModel, tag_id)
    return row.name if row else str(tag_id)


async def _collection_name(db: AsyncSession, cid: UUID) -> str:
    row = await db.get(CollectionModel, cid)
    return row.name if row else str(cid)


async def _merchant_label(db: AsyncSession, mid: UUID) -> str:
    row = await db.get(MerchantModel, mid)
    if not row:
        return str(mid)
    return row.alias or row.canonical_name


async def _payment_label(db: AsyncSession, pid: UUID) -> str:
    row = await db.get(PaymentModel, pid)
    if not row:
        return str(pid)
    m = await db.get(MerchantModel, row.merchant_id)
    name = (m.alias or m.canonical_name) if m else row.description
    return f"{name} ({row.date.isoformat()})"


async def _resolve_tag_id(db: AsyncSession, args: dict[str, Any]) -> UUID:
    if args.get("tag_id"):
        return UUID(args["tag_id"])
    if args.get("tag_name"):
        normalized = Tag(args["tag_name"]).name
        result = await db.execute(select(TagModel).where(TagModel.name == normalized))
        row = result.scalar_one_or_none()
        if not row:
            raise ValueError(f"Tag not found: {args['tag_name']}")
        return row.id
    raise ValueError("tag_id or tag_name required")


async def _load_payment(db: AsyncSession, payment_id: str):
    repo = SqlPaymentRepository(db)
    payment = await repo.find_by_id(PaymentId(UUID(payment_id)))
    if not payment:
        raise ValueError("Payment not found")
    return payment


async def _create_tag(db: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    tid, name = await app_create_tag(db, args["name"])
    await db.commit()
    return {"id": str(tid), "name": name}


async def _summarize_create_tag(db: AsyncSession, args: dict[str, Any]) -> str:
    return f"Create tag «{Tag(args['name']).name}»"


async def _tag_payment(db: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    payment = await _load_payment(db, args["payment_id"])
    tag_id = await _resolve_tag_id(db, args)
    merged = list(dict.fromkeys([*payment.payment_tag_ids, tag_id]))
    await apply_payment_patch(db, payment, PatchPaymentBody(payment_tags=[str(x) for x in merged]))
    await db.commit()
    return {"payment_id": args["payment_id"], "tag_id": str(tag_id)}


async def _summarize_tag_payment(db: AsyncSession, args: dict[str, Any]) -> str:
    tag_id = await _resolve_tag_id(db, args)
    tname = await _tag_name(db, tag_id)
    plabel = await _payment_label(db, UUID(args["payment_id"]))
    return f"Tag «{plabel}» with «{tname}»"


async def _untag_payment(db: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    payment = await _load_payment(db, args["payment_id"])
    tag_id = await _resolve_tag_id(db, args)
    merged = [t for t in payment.payment_tag_ids if t != tag_id]
    await apply_payment_patch(db, payment, PatchPaymentBody(payment_tags=[str(x) for x in merged]))
    await db.commit()
    return {"payment_id": args["payment_id"], "tag_id": str(tag_id)}


async def _summarize_untag_payment(db: AsyncSession, args: dict[str, Any]) -> str:
    tag_id = await _resolve_tag_id(db, args)
    tname = await _tag_name(db, tag_id)
    plabel = await _payment_label(db, UUID(args["payment_id"]))
    return f"Remove tag «{tname}» from «{plabel}»"


async def _create_collection(db: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    try:
        cid, name = await app_create_collection(db, args["name"])
    except ValueError as e:
        raise ValueError(str(e)) from e
    await db.commit()
    return {"id": str(cid), "name": name}


async def _summarize_create_collection(_db: AsyncSession, args: dict[str, Any]) -> str:
    return f"Create collection «{args['name'].strip()}»"


async def _add_to_collection(db: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    payment = await _load_payment(db, args["payment_id"])
    cid = UUID(args["collection_id"])
    merged = list(dict.fromkeys([*payment.collection_ids, cid]))
    await apply_payment_patch(db, payment, PatchPaymentBody(collection_ids=[str(x) for x in merged]))
    await db.commit()
    return {"payment_id": args["payment_id"], "collection_id": str(cid)}


async def _summarize_add_to_collection(db: AsyncSession, args: dict[str, Any]) -> str:
    cname = await _collection_name(db, UUID(args["collection_id"]))
    plabel = await _payment_label(db, UUID(args["payment_id"]))
    return f"Add «{plabel}» to collection «{cname}»"


async def _remove_from_collection(db: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    payment = await _load_payment(db, args["payment_id"])
    cid = UUID(args["collection_id"])
    merged = [c for c in payment.collection_ids if c != cid]
    await apply_payment_patch(db, payment, PatchPaymentBody(collection_ids=[str(x) for x in merged]))
    await db.commit()
    return {"payment_id": args["payment_id"], "collection_id": str(cid)}


async def _summarize_remove_from_collection(db: AsyncSession, args: dict[str, Any]) -> str:
    cname = await _collection_name(db, UUID(args["collection_id"]))
    plabel = await _payment_label(db, UUID(args["payment_id"]))
    return f"Remove «{plabel}» from collection «{cname}»"


async def _upsert_splitwise_rule(db: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    client = SplitwiseManagerClient(settings.splitwise_manager_url)
    if not client.configured:
        raise ValueError("Splitwise not configured")
    merchant_id = UUID(args["merchant_id"])
    body = {
        "enabled": args.get("enabled", True),
        "splitwise_group_id": int(args["splitwise_group_id"]),
        "split_method": args["split_method"],
        "split_params": args.get("split_params", {}),
        "currency": args.get("currency", "ILS"),
    }
    try:
        rule = await client.put_rule(merchant_id, body)
    except (SplitwiseManagerUnavailable, SplitwiseManagerError) as e:
        raise ValueError(str(e)) from e
    return rule


async def _summarize_upsert_splitwise_rule(db: AsyncSession, args: dict[str, Any]) -> str:
    mlabel = await _merchant_label(db, UUID(args["merchant_id"]))
    gid = args["splitwise_group_id"]
    return f"Set Splitwise share rule for «{mlabel}» (group {gid}, {args.get('split_method', 'equal')})"


async def _delete_splitwise_rule(db: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    client = SplitwiseManagerClient(settings.splitwise_manager_url)
    if not client.configured:
        raise ValueError("Splitwise not configured")
    merchant_id = UUID(args["merchant_id"])
    try:
        await client.delete_rule(merchant_id)
    except (SplitwiseManagerUnavailable, SplitwiseManagerError) as e:
        raise ValueError(str(e)) from e
    return {"merchant_id": str(merchant_id), "deleted": True}


async def _summarize_delete_splitwise_rule(db: AsyncSession, args: dict[str, Any]) -> str:
    mlabel = await _merchant_label(db, UUID(args["merchant_id"]))
    return f"Delete Splitwise share rule for «{mlabel}»"


def _register_writes() -> None:
    register_tool(
        ToolSpec(
            name="create_tag",
            description="Create a new tag (normalized lowercase).",
            parameters={
                "type": "object",
                "properties": {"name": {"type": "string"}},
                "required": ["name"],
            },
            is_write=True,
            handler=_create_tag,
            summarize=_summarize_create_tag,
        )
    )
    register_tool(
        ToolSpec(
            name="tag_payment",
            description="Add a tag to a payment. Use tag_id or exact tag_name.",
            parameters={
                "type": "object",
                "properties": {
                    "payment_id": {"type": "string"},
                    "tag_id": {"type": "string"},
                    "tag_name": {"type": "string"},
                },
                "required": ["payment_id"],
            },
            is_write=True,
            handler=_tag_payment,
            summarize=_summarize_tag_payment,
        )
    )
    register_tool(
        ToolSpec(
            name="untag_payment",
            description="Remove a tag from a payment.",
            parameters={
                "type": "object",
                "properties": {
                    "payment_id": {"type": "string"},
                    "tag_id": {"type": "string"},
                    "tag_name": {"type": "string"},
                },
                "required": ["payment_id"],
            },
            is_write=True,
            handler=_untag_payment,
            summarize=_summarize_untag_payment,
        )
    )
    register_tool(
        ToolSpec(
            name="create_collection",
            description="Create a new collection.",
            parameters={
                "type": "object",
                "properties": {"name": {"type": "string"}},
                "required": ["name"],
            },
            is_write=True,
            handler=_create_collection,
            summarize=_summarize_create_collection,
        )
    )
    register_tool(
        ToolSpec(
            name="add_to_collection",
            description="Add a payment to a collection.",
            parameters={
                "type": "object",
                "properties": {
                    "payment_id": {"type": "string"},
                    "collection_id": {"type": "string"},
                },
                "required": ["payment_id", "collection_id"],
            },
            is_write=True,
            handler=_add_to_collection,
            summarize=_summarize_add_to_collection,
        )
    )
    register_tool(
        ToolSpec(
            name="remove_from_collection",
            description="Remove a payment from a collection.",
            parameters={
                "type": "object",
                "properties": {
                    "payment_id": {"type": "string"},
                    "collection_id": {"type": "string"},
                },
                "required": ["payment_id", "collection_id"],
            },
            is_write=True,
            handler=_remove_from_collection,
            summarize=_summarize_remove_from_collection,
        )
    )
    register_tool(
        ToolSpec(
            name="upsert_splitwise_rule",
            description="Create or update Splitwise auto-share rule for a merchant.",
            parameters={
                "type": "object",
                "properties": {
                    "merchant_id": {"type": "string"},
                    "enabled": {"type": "boolean"},
                    "splitwise_group_id": {"type": "integer"},
                    "split_method": {
                        "type": "string",
                        "enum": ["equal", "exact", "percentage", "shares"],
                    },
                    "split_params": {"type": "object"},
                    "currency": {"type": "string"},
                },
                "required": ["merchant_id", "splitwise_group_id", "split_method"],
            },
            is_write=True,
            handler=_upsert_splitwise_rule,
            summarize=_summarize_upsert_splitwise_rule,
        )
    )
    register_tool(
        ToolSpec(
            name="delete_splitwise_rule",
            description="Delete Splitwise auto-share rule for a merchant.",
            parameters={
                "type": "object",
                "properties": {"merchant_id": {"type": "string"}},
                "required": ["merchant_id"],
            },
            is_write=True,
            handler=_delete_splitwise_rule,
            summarize=_summarize_delete_splitwise_rule,
        )
    )


_register_writes()
