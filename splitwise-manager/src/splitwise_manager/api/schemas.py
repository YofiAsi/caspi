from __future__ import annotations

from datetime import date as date_t
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from splitwise_manager.domain.value_objects.enums import SplitMethod


class StatusResponse(BaseModel):
    connected: bool
    source: str | None
    splitwise_user_id: int | None
    last_validated_at: str | None
    queued: int
    failed: int


class ConnectRequestBody(BaseModel):
    consumer_key: str | None = None
    consumer_secret: str | None = None
    api_key: str | None = None


class ConnectResponse(BaseModel):
    source: str
    splitwise_user_id: int


class GroupMemberSchema(BaseModel):
    user_id: int
    first_name: str
    last_name: str | None = None


class GroupSchema(BaseModel):
    id: int
    name: str
    members: list[GroupMemberSchema]


class GroupsResponse(BaseModel):
    groups: list[GroupSchema]


class ShareRequestBody(BaseModel):
    payment_id: UUID
    amount: Decimal
    currency: str = Field(min_length=3, max_length=3)
    group_id: int
    split_method: SplitMethod
    split_params: dict[str, Any] = Field(default_factory=dict)
    description: str = ""
    date: date_t | None = None


class ShareResponse(BaseModel):
    my_share_amount: Decimal
    my_share_currency: str
    outbox_id: UUID


class UnshareResponse(BaseModel):
    delete_enqueued: bool
    outbox_id: UUID | None


class RuleBody(BaseModel):
    enabled: bool
    splitwise_group_id: int
    split_method: SplitMethod
    split_params: dict[str, Any] = Field(default_factory=dict)
    currency: str = "ILS"


class RuleResponse(BaseModel):
    merchant_id: UUID
    enabled: bool
    splitwise_group_id: int
    split_method: SplitMethod
    split_params: dict[str, Any]
    currency: str


class ApplyRuleBody(BaseModel):
    payment_id: UUID
    merchant_id: UUID
    amount: Decimal
    currency: str = Field(min_length=3, max_length=3)
    description: str = ""
    date: date_t | None = None


class ApplyRuleResponse(BaseModel):
    shared: bool
    my_share_amount: Decimal | None = None
    my_share_currency: str | None = None


class OutboxEntryResponse(BaseModel):
    id: UUID
    payment_id: UUID | None
    operation: str
    status: str
    attempts: int
    last_error: str | None
    next_attempt_at: str | None
    created_at: str | None
    updated_at: str | None


class FailedListResponse(BaseModel):
    entries: list[OutboxEntryResponse]


class RetryResponse(BaseModel):
    outbox_id: UUID | None
    requeued: bool
