from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ToolCallFunction(BaseModel):
    name: str
    arguments: str


class ToolCall(BaseModel):
    id: str
    type: str = "function"
    function: ToolCallFunction


class Message(BaseModel):
    role: str
    content: Optional[str] = None
    tool_calls: Optional[list[ToolCall]] = None
    tool_call_id: Optional[str] = None
    name: Optional[str] = None


class PendingAction(BaseModel):
    action_id: str
    tool_name: str
    arguments: dict[str, Any]
    summary: str


class ChatResponse(BaseModel):
    status: Literal["message", "pending_action", "error"]
    messages: list[dict[str, Any]]
    pending_action: Optional[PendingAction] = None
    error: Optional[str] = None


class ChatRequest(BaseModel):
    messages: list[dict[str, Any]] = Field(default_factory=list)


class ExecuteActionRequest(BaseModel):
    messages: list[dict[str, Any]] = Field(default_factory=list)
    action_id: str
    decision: Literal["approve", "reject"]
