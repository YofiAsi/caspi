from __future__ import annotations

import json
import re
from typing import Any

import litellm

from caspi.application.ai_settings import LLMConfig

litellm.drop_params = True

MAX_ITERATIONS = 8


def _strip_thinking_content(content: str | None) -> str | None:
    if content is None:
        return None
    text = content.strip()
    if not text:
        return None
    if text.startswith("{"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                if set(parsed.keys()) <= {"thinking"} and parsed.get("thinking"):
                    return None
                if "thinking" in parsed and isinstance(parsed.get("content"), str):
                    return parsed["content"].strip() or None
        except json.JSONDecodeError:
            pass
    if re.fullmatch(r'\{\s*"thinking"\s*:\s*".*', text, re.DOTALL):
        return None
    return content


def normalize_assistant_message(msg: dict[str, Any]) -> dict[str, Any]:
    out = dict(msg)
    if out.get("role") == "assistant":
        out["content"] = _strip_thinking_content(out.get("content"))
    return out


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
    msg = normalize_assistant_message(resp.choices[0].message.model_dump())
    return msg


def parse_tool_args(arguments: str) -> dict[str, Any]:
    if not arguments:
        return {}
    return json.loads(arguments)
