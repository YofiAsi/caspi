from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from caspi.domain.value_objects.enums import PaymentSource, PaymentType
from caspi.domain.value_objects.ids import CategoryId, ImportId, PaymentId
from caspi.domain.value_objects.money import Money
from caspi.domain.value_objects.shared_payment import SharedPayment
from caspi.domain.value_objects.tag import Tag


@dataclass
class Payment:
    payment_id: PaymentId
    amount: Money
    date: date
    description: str
    source: PaymentSource
    import_id: ImportId
    merchant: str | None = None
    payment_type: PaymentType = PaymentType.UNKNOWN
    category_id: CategoryId | None = None
    shared_payment: SharedPayment | None = None
    tags: list[Tag] = field(default_factory=list)
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

    def add_tag(self, tag: Tag) -> None:
        if tag not in self.tags:
            self.tags.append(tag)

    def remove_tag(self, tag: Tag) -> None:
        self.tags = [t for t in self.tags if t != tag]
