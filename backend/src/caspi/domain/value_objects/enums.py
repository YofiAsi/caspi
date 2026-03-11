from enum import Enum


class PaymentSource(str, Enum):
    ISRACARD = "isracard"
    BANK = "bank"
    BIT = "bit"


class PaymentType(str, Enum):
    RECURRING = "recurring"
    ONE_TIME = "one_time"
    UNKNOWN = "unknown"


class ShareType(str, Enum):
    PERCENTAGE = "percentage"
    FIXED = "fixed"
