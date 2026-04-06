from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal

import httpx

from caspi.domain.entities import ImportBatch, Payment
from caspi.domain.repositories import ImportBatchRepository, MerchantRepository, PaymentRepository
from caspi.domain.value_objects import ImportId, Money, PaymentId, PaymentSource


@dataclass
class ScrapeIsracardRequest:
    id: str
    card6_digits: str
    password: str
    start_date: date | None = None
    end_date: date | None = None


@dataclass
class ScrapeIsracardResult:
    import_id: ImportId
    payment_count: int
    imported_at: datetime


def _decimal_to_json_number(d: Decimal) -> float | int:
    q = d.quantize(Decimal("0.01"))
    if (q % Decimal("1")).is_zero():
        return int(q)
    return float(q)


def aligned_original_amount_for_store(charged_amount: Decimal, original_raw: object) -> float | int | None:
    if original_raw is None:
        return None
    try:
        parsed = Decimal(str(original_raw))
    except Exception:
        return None
    if charged_amount == 0 or parsed == 0:
        return _decimal_to_json_number(parsed)
    aligned = abs(parsed) if charged_amount > 0 else -abs(parsed)
    return _decimal_to_json_number(aligned)


async def import_isracard_accounts(
    accounts: list,
    *,
    payment_repo: PaymentRepository,
    import_batch_repo: ImportBatchRepository,
    merchant_repo: MerchantRepository,
) -> ScrapeIsracardResult:
    imported_at = datetime.now(timezone.utc)
    import_id = ImportId()
    payments: list[Payment] = []

    existing_identifiers = await payment_repo.find_source_identifiers(PaymentSource.ISRACARD)

    for account in accounts:
        account_number = account.get("accountNumber", "unknown")
        for txn in account.get("txns", []):
            identifier = txn.get("identifier")
            if identifier is not None and str(identifier) in existing_identifiers:
                continue
            charged_amount = -Decimal(str(txn.get("chargedAmount", 0)))
            txn_date = date.fromisoformat(txn.get("date", "")[:10])
            description = txn.get("description", "")

            installments = txn.get("installments")
            canon = description.strip().lower()
            merchant_id = await merchant_repo.ensure_by_canonical_name(canon)
            payment = Payment(
                payment_id=PaymentId(),
                amount=Money(charged_amount, "ILS"),
                date=txn_date,
                description=description,
                source=PaymentSource.ISRACARD,
                import_id=import_id,
                merchant_id=merchant_id,
                merchant_canonical_name=canon,
                extra={
                    "account_number": account_number,
                    "original_amount": aligned_original_amount_for_store(
                        charged_amount, txn.get("originalAmount")
                    ),
                    "original_currency": txn.get("originalCurrency"),
                    "processed_date": txn.get("processedDate"),
                    "memo": txn.get("memo"),
                    "status": txn.get("status"),
                    "identifier": txn.get("identifier"),
                    "type": txn.get("type"),
                    "installment_number": installments.get("number") if installments else None,
                    "installment_total": installments.get("total") if installments else None,
                    "category": txn.get("category"),
                    "extended_details": txn.get("extendedDetails"),
                },
            )

            payments.append(payment)

    import_batch = ImportBatch(
        import_id=import_id,
        source=PaymentSource.ISRACARD,
        file_name=f"isracard_{imported_at.date().isoformat()}",
        imported_at=imported_at,
        payment_count=len(payments),
    )

    await import_batch_repo.save(import_batch)
    for payment in payments:
        await payment_repo.save(payment)

    return ScrapeIsracardResult(
        import_id=import_id,
        payment_count=len(payments),
        imported_at=imported_at,
    )


class ScrapeIsracardUseCase:
    def __init__(
        self,
        scraper_url: str,
        payment_repo: PaymentRepository,
        import_batch_repo: ImportBatchRepository,
        merchant_repo: MerchantRepository,
    ):
        self._scraper_url = scraper_url
        self._payment_repo = payment_repo
        self._import_batch_repo = import_batch_repo
        self._merchant_repo = merchant_repo

    async def execute(self, request: ScrapeIsracardRequest) -> ScrapeIsracardResult:
        body: dict = {
            "id": request.id,
            "card6Digits": request.card6_digits,
            "password": request.password,
        }
        if request.start_date:
            body["startDate"] = request.start_date.isoformat()
        if request.end_date:
            body["endDate"] = request.end_date.isoformat()

        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{self._scraper_url}/scrape/isracard",
                json=body,
            )
            response.raise_for_status()
            data = response.json()

        return await import_isracard_accounts(
            data.get("accounts", []),
            payment_repo=self._payment_repo,
            import_batch_repo=self._import_batch_repo,
            merchant_repo=self._merchant_repo,
        )
