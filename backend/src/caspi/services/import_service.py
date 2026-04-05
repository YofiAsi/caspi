from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from caspi import settings
from caspi.infrastructure.models import ExpenseModel, MerchantModel


async def run_scrape_and_import(
    *,
    db: AsyncSession,
    user_id: uuid.UUID,
    provider: str,
    credentials: dict,
    start_date: date | None,
    end_date: date | None,
) -> dict:
    """Call the scraper service, then upsert expenses. Returns {imported, skipped, errors}."""

    scraper_body: dict = {**credentials}
    if start_date:
        scraper_body["startDate"] = start_date.isoformat()
    if end_date:
        scraper_body["endDate"] = end_date.isoformat()

    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(f"{settings.SCRAPER_URL}/scrape/{provider}", json=scraper_body)

    if resp.status_code != 200:
        return {"imported": 0, "skipped": 0, "errors": [resp.json().get("message", "Scrape failed")]}

    accounts = resp.json().get("accounts", [])

    imported = 0
    skipped = 0
    errors: list[str] = []

    for account in accounts:
        for txn in account.get("txns", []):
            try:
                source_id = txn.get("identifier") or txn.get("memo") or f"{txn['date']}_{txn['chargedAmount']}_{txn.get('description','')}"

                # Skip if already imported
                existing = await db.execute(
                    select(ExpenseModel.id).where(
                        ExpenseModel.user_id == user_id,
                        ExpenseModel.source_identifier == source_id,
                    )
                )
                if existing.scalar_one_or_none():
                    skipped += 1
                    continue

                # Upsert merchant by canonical_name
                raw_name = txn.get("description", "Unknown")
                merchant_result = await db.execute(
                    select(MerchantModel).where(
                        MerchantModel.user_id == user_id,
                        func.lower(MerchantModel.canonical_name) == raw_name.lower(),
                    )
                )
                merchant = merchant_result.scalar_one_or_none()
                if not merchant:
                    merchant = MerchantModel(id=uuid.uuid4(), user_id=user_id, canonical_name=raw_name)
                    db.add(merchant)
                    await db.flush()

                full_amount = Decimal(str(txn.get("chargedAmount", 0)))
                currency = txn.get("originalCurrency", "ILS")

                # Apply merchant default share
                share = None
                share_amount = None
                personal_amount = full_amount
                if merchant.default_share_amount is not None:
                    share_amount = Decimal(str(merchant.default_share_amount))
                    personal_amount = full_amount - share_amount
                elif merchant.default_share is not None:
                    share = Decimal(str(merchant.default_share))
                    personal_amount = (full_amount * share).quantize(Decimal("0.01"))

                txn_date_str = txn.get("date", "")
                if txn_date_str:
                    txn_date = datetime.fromisoformat(txn_date_str.replace("Z", "+00:00")).date()
                else:
                    txn_date = date.today()

                payment_type = txn.get("type", "normal")

                expense = ExpenseModel(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    date=txn_date,
                    merchant_id=merchant.id,
                    full_amount=full_amount,
                    currency=currency,
                    share=share,
                    share_amount=share_amount,
                    personal_amount=personal_amount,
                    source_identifier=source_id,
                    payment_type=payment_type,
                    extra={"raw": txn},
                )
                db.add(expense)
                imported += 1

            except Exception as exc:
                errors.append(str(exc))

    await db.commit()
    return {"imported": imported, "skipped": skipped, "errors": errors}
