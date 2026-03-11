from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal

import httpx

from caspi.domain.entities import ImportBatch, Payment, SharingRule
from caspi.domain.repositories import ImportBatchRepository, PaymentRepository, SharingRuleRepository
from caspi.domain.value_objects import ImportId, Money, PaymentId, PaymentSource, ShareType, SharedPayment


@dataclass
class ScrapeIsracardRequest:
    id: str
    card6_digits: str
    password: str
    start_date: date | None = None


@dataclass
class ScrapeIsracardResult:
    import_id: ImportId
    payment_count: int
    imported_at: datetime


def _apply_sharing_rule(payment: Payment, rule: SharingRule) -> None:
    target = payment.merchant or payment.description
    if not rule.matches(target):
        return
    if rule.share_type == ShareType.PERCENTAGE:
        my_share = payment.amount * (rule.share_value / Decimal("100"))
    else:
        if rule.currency != payment.amount.currency:
            return
        my_share = Money(rule.share_value, rule.currency)
    try:
        payment.set_shared(SharedPayment(my_share=my_share))
    except ValueError:
        pass


class ScrapeIsracardUseCase:
    def __init__(
        self,
        scraper_url: str,
        payment_repo: PaymentRepository,
        import_batch_repo: ImportBatchRepository,
        sharing_rule_repo: SharingRuleRepository,
    ):
        self._scraper_url = scraper_url
        self._payment_repo = payment_repo
        self._import_batch_repo = import_batch_repo
        self._sharing_rule_repo = sharing_rule_repo

    async def execute(self, request: ScrapeIsracardRequest) -> ScrapeIsracardResult:
        body: dict = {
            "id": request.id,
            "card6Digits": request.card6_digits,
            "password": request.password,
        }
        if request.start_date:
            body["startDate"] = request.start_date.isoformat()

        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{self._scraper_url}/scrape/isracard",
                json=body,
            )
            response.raise_for_status()
            data = response.json()

        imported_at = datetime.now(timezone.utc)
        import_id = ImportId()
        payments: list[Payment] = []

        existing_identifiers = await self._payment_repo.find_source_identifiers(PaymentSource.ISRACARD)
        sharing_rules = await self._sharing_rule_repo.find_all()

        for account in data.get("accounts", []):
            account_number = account.get("accountNumber", "unknown")
            for txn in account.get("txns", []):
                identifier = txn.get("identifier")
                if identifier is not None and str(identifier) in existing_identifiers:
                    continue
                charged_amount = -Decimal(str(txn.get("chargedAmount", 0)))
                txn_date = date.fromisoformat(txn.get("date", "")[:10])
                description = txn.get("description", "")

                installments = txn.get("installments")
                payment = Payment(
                    payment_id=PaymentId(),
                    amount=Money(charged_amount, "ILS"),
                    date=txn_date,
                    description=description,
                    source=PaymentSource.ISRACARD,
                    import_id=import_id,
                    merchant=description,
                    extra={
                        "account_number": account_number,
                        "original_amount": txn.get("originalAmount"),
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
                if charged_amount >= 0:
                    for rule in sharing_rules:
                        _apply_sharing_rule(payment, rule)
                        if payment.shared_payment is not None:
                            break

                payments.append(payment)

        import_batch = ImportBatch(
            import_id=import_id,
            source=PaymentSource.ISRACARD,
            file_name=f"isracard_{imported_at.date().isoformat()}",
            imported_at=imported_at,
            payment_count=len(payments),
        )

        await self._import_batch_repo.save(import_batch)
        for payment in payments:
            await self._payment_repo.save(payment)

        return ScrapeIsracardResult(
            import_id=import_id,
            payment_count=len(payments),
            imported_at=imported_at,
        )
