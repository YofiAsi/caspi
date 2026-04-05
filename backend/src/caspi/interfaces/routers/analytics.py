from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi.infrastructure.database import get_db
from caspi.infrastructure.models import ExpenseModel, MerchantModel, TagModel, expense_tags
from caspi.interfaces.dependencies import get_user_id
from caspi.interfaces.schemas import MerchantBucket, MonthlyBucket, TagBucket

router = APIRouter(prefix="/api/analytics/routine", tags=["analytics"])


def _routine_base(user_id: uuid.UUID, start_date: date | None, end_date: date | None):
    stmt = select(ExpenseModel).where(
        ExpenseModel.user_id == user_id,
        ExpenseModel.collection_id.is_(None),
    )
    if start_date:
        stmt = stmt.where(ExpenseModel.date >= start_date)
    if end_date:
        stmt = stmt.where(ExpenseModel.date <= end_date)
    return stmt


@router.get("/monthly", response_model=dict)
async def routine_monthly(
    start_date: date | None = None,
    end_date: date | None = None,
    user_id: uuid.UUID = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(
            func.to_char(ExpenseModel.date, "YYYY-MM").label("month"),
            func.sum(ExpenseModel.personal_amount),
            func.count(ExpenseModel.id),
        )
        .where(
            ExpenseModel.user_id == user_id,
            ExpenseModel.collection_id.is_(None),
        )
    )
    if start_date:
        stmt = stmt.where(ExpenseModel.date >= start_date)
    if end_date:
        stmt = stmt.where(ExpenseModel.date <= end_date)
    stmt = stmt.group_by("month").order_by("month")

    result = await db.execute(stmt)
    return {
        "months": [
            MonthlyBucket(month=month, total_personal=Decimal(str(total)), expense_count=count)
            for month, total, count in result
        ]
    }


@router.get("/by-tag", response_model=dict)
async def routine_by_tag(
    start_date: date | None = None,
    end_date: date | None = None,
    user_id: uuid.UUID = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(
            TagModel.id,
            TagModel.name,
            func.sum(ExpenseModel.personal_amount),
            func.count(ExpenseModel.id),
        )
        .join(expense_tags, expense_tags.c.expense_id == ExpenseModel.id)
        .join(TagModel, TagModel.id == expense_tags.c.tag_id)
        .where(
            ExpenseModel.user_id == user_id,
            ExpenseModel.collection_id.is_(None),
        )
    )
    if start_date:
        stmt = stmt.where(ExpenseModel.date >= start_date)
    if end_date:
        stmt = stmt.where(ExpenseModel.date <= end_date)
    stmt = stmt.group_by(TagModel.id, TagModel.name).order_by(func.sum(ExpenseModel.personal_amount).desc())

    result = await db.execute(stmt)
    return {
        "tags": [
            TagBucket(tag_id=tid, tag_name=name, total_personal=Decimal(str(total)), expense_count=count)
            for tid, name, total, count in result
        ]
    }


@router.get("/by-merchant", response_model=dict)
async def routine_by_merchant(
    start_date: date | None = None,
    end_date: date | None = None,
    user_id: uuid.UUID = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(
            MerchantModel.id,
            func.coalesce(MerchantModel.alias, MerchantModel.canonical_name),
            func.sum(ExpenseModel.personal_amount),
            func.count(ExpenseModel.id),
        )
        .join(MerchantModel, MerchantModel.id == ExpenseModel.merchant_id)
        .where(
            ExpenseModel.user_id == user_id,
            ExpenseModel.collection_id.is_(None),
        )
    )
    if start_date:
        stmt = stmt.where(ExpenseModel.date >= start_date)
    if end_date:
        stmt = stmt.where(ExpenseModel.date <= end_date)
    stmt = stmt.group_by(MerchantModel.id, MerchantModel.alias, MerchantModel.canonical_name).order_by(
        func.sum(ExpenseModel.personal_amount).desc()
    )

    result = await db.execute(stmt)
    return {
        "merchants": [
            MerchantBucket(merchant_id=mid, merchant_name=name, total_personal=Decimal(str(total)), expense_count=count)
            for mid, name, total, count in result
        ]
    }
