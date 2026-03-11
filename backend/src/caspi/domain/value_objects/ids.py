from uuid import UUID, uuid4


class PaymentId:
    def __init__(self, value: UUID | None = None) -> None:
        self.value = value or uuid4()

    def __eq__(self, other: object) -> bool:
        return isinstance(other, PaymentId) and self.value == other.value

    def __hash__(self) -> int:
        return hash(self.value)

    def __repr__(self) -> str:
        return f"PaymentId({self.value})"


class CategoryId:
    def __init__(self, value: UUID | None = None) -> None:
        self.value = value or uuid4()

    def __eq__(self, other: object) -> bool:
        return isinstance(other, CategoryId) and self.value == other.value

    def __hash__(self) -> int:
        return hash(self.value)

    def __repr__(self) -> str:
        return f"CategoryId({self.value})"


class ImportId:
    def __init__(self, value: UUID | None = None) -> None:
        self.value = value or uuid4()

    def __eq__(self, other: object) -> bool:
        return isinstance(other, ImportId) and self.value == other.value

    def __hash__(self) -> int:
        return hash(self.value)

    def __repr__(self) -> str:
        return f"ImportId({self.value})"


class RuleId:
    def __init__(self, value: UUID | None = None) -> None:
        self.value = value or uuid4()

    def __eq__(self, other: object) -> bool:
        return isinstance(other, RuleId) and self.value == other.value

    def __hash__(self) -> int:
        return hash(self.value)

    def __repr__(self) -> str:
        return f"RuleId({self.value})"
