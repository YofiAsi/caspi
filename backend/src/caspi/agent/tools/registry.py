from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

ToolHandler = Callable[[AsyncSession, dict[str, Any]], Awaitable[Any]]
SummarizeFn = Callable[[AsyncSession, dict[str, Any]], Awaitable[str]]


@dataclass
class ToolSpec:
    name: str
    description: str
    parameters: dict[str, Any]
    is_write: bool
    handler: ToolHandler
    summarize: SummarizeFn | None = None

    def __post_init__(self) -> None:
        if self.is_write and self.summarize is None:
            raise ValueError(f"write tool {self.name} must have summarize")
        if not self.is_write and self.summarize is not None:
            raise ValueError(f"read tool {self.name} must not have summarize")


def _openai_tool(spec: ToolSpec) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": spec.name,
            "description": spec.description,
            "parameters": spec.parameters,
        },
    }


TOOLS: list[ToolSpec] = []


def _register(spec: ToolSpec) -> None:
    TOOLS.append(spec)


def tools_openai_schema() -> list[dict[str, Any]]:
    return [_openai_tool(s) for s in TOOLS]


def get_tool(name: str) -> ToolSpec | None:
    for t in TOOLS:
        if t.name == name:
            return t
    return None


def register_tool(spec: ToolSpec) -> None:
    _register(spec)
