from __future__ import annotations

import json
from typing import Any

import litellm

from caspi.application.ai_settings import LLMConfig

litellm.drop_params = True

MAX_ITERATIONS = 8


async def acompletion(
    config: LLMConfig,
    messages: list[dict[str, Any]],
    *,
    tools: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "model": config.model,
        "messages": messages,
        "tool_choice": "auto",
    }
    if tools:
        kwargs["tools"] = tools
    if config.api_base:
        kwargs["api_base"] = config.api_base
    if config.api_key:
        kwargs["api_key"] = config.api_key
    resp = await litellm.acompletion(**kwargs)
    msg = resp.choices[0].message
    return msg.model_dump()


def parse_tool_args(arguments: str) -> dict[str, Any]:
    if not arguments:
        return {}
    return json.loads(arguments)
