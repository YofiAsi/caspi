from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from uuid import UUID

from caspi.domain.value_objects.enums import PaymentSource, PaymentType
from caspi.domain.value_objects.ids import CategoryId, ImportId, MerchantId, PaymentId
from caspi.domain.value_objects.money import Money
from caspi.domain.value_objects.shared_payment import SharedPayment


@dataclass
class Payment:
    payment_id: PaymentId
    amount: Money
    date: date
    description: str
    source: PaymentSource
    import_id: ImportId
    merchant_id: MerchantId
    merchant_canonical_name: str
    payment_type: PaymentType = PaymentType.UNKNOWN
    category_id: CategoryId | None = None
    shared_payment: SharedPayment | None = None
    payment_tag_ids: list[UUID] = field(default_factory=list)
    collection_ids: list[UUID] = field(default_factory=list)
    extra: dict = field(default_factory=dict)

    @property
    def effective_amount(self) -> Money:
        if self.shared_payment is not None:
            return self.shared_payment.my_share
        return self.amount

    def assign_category(self, category_id: CategoryId) -> None:
        self.category_id = category_id

    def set_payment_type(self, payment_type: PaymentType) -> None:
        self.payment_type = payment_type

    def set_shared(self, shared_payment: SharedPayment) -> None:
        if self.amount.amount >= 0 and shared_payment.my_share > self.amount:
            raise ValueError("my_share cannot exceed the total payment amount")
        self.shared_payment = shared_payment

    def set_payment_tag_ids(self, tag_ids: list[UUID]) -> None:
        seen: set[UUID] = set()
        out: list[UUID] = []
        for tid in tag_ids:
            if tid not in seen:
                seen.add(tid)
                out.append(tid)
        self.payment_tag_ids = out

    def set_collection_ids(self, ids: list[UUID]) -> None:
        seen: set[UUID] = set()
        out: list[UUID] = []
        for cid in ids:
            if cid not in seen:
                seen.add(cid)
                out.append(cid)
        self.collection_ids = out
