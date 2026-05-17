from enum import Enum


class SplitMethod(str, Enum):
    EQUAL = "equal"
    PERCENTAGE = "percentage"
    SHARES = "shares"


class OutboxStatus(str, Enum):
    QUEUED = "queued"
    IN_PROGRESS = "in_progress"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class OutboxOperation(str, Enum):
    PUSH = "push"
    DELETE = "delete"


class LinkStatus(str, Enum):
    PENDING = "pending"
    PUSHED = "pushed"
    FAILED = "failed"
    DELETED_REMOTE = "deleted_remote"
