from __future__ import annotations

import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from caspi.application.ai_settings import AIConfigError, LLMConfig, resolve_llm_config
from caspi.agent.llm import MAX_ITERATIONS, acompletion, parse_tool_args
from caspi.agent.prompts import SYSTEM_PROMPT
from caspi.agent.schemas import ChatResponse, PendingAction
from caspi.agent.tools import reads as _reads  # noqa: F401
from caspi.agent.tools import writes as _writes  # noqa: F401
from caspi.agent.tools.registry import TOOLS, get_tool, tools_openai_schema


def _ensure_system(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if messages and messages[0].get("role") == "system":
        out = list(messages)
        out[0] = {"role": "system", "content": SYSTEM_PROMPT}
        return out
    return [{"role": "system", "content": SYSTEM_PROMPT}, *messages]


def _tool_result_message(tool_call_id: str, content: Any) -> dict[str, Any]:
    if isinstance(content, str):
        text = content
    else:
        text = json.dumps(content, default=str)
    return {"role": "tool", "tool_call_id": tool_call_id, "content": text}


def _find_pending_tool_call(messages: list[dict[str, Any]], action_id: str) -> tuple[dict[str, Any], dict[str, Any]] | None:
    fulfilled: set[str] = set()
    for m in messages:
        if m.get("role") == "tool" and m.get("tool_call_id"):
            fulfilled.add(m["tool_call_id"])
    for m in reversed(messages):
        if m.get("role") != "assistant":
            continue
        for tc in m.get("tool_calls") or []:
            tid = tc.get("id")
            if tid == action_id and tid not in fulfilled:
                return m, tc
    return None


async def _run_tool(
    db: AsyncSession,
    tool_name: str,
    args: dict[str, Any],
) -> Any:
    spec = get_tool(tool_name)
    if spec is None:
        return {"error": f"Unknown tool: {tool_name}"}
    try:
        return await spec.handler(db, args)
    except Exception as e:
        return {"error": str(e)}


async def run_agent_loop(
    db: AsyncSession,
    messages: list[dict[str, Any]],
    *,
    config: LLMConfig | None = None,
) -> ChatResponse:
    try:
        llm_config = config or await resolve_llm_config(db)
    except AIConfigError as e:
        return ChatResponse(status="error", messages=messages, error=str(e))

    transcript = _ensure_system(messages)
    tools_schema = tools_openai_schema()

    for _ in range(MAX_ITERATIONS):
        assistant_msg = await acompletion(llm_config, transcript, tools=tools_schema)
        transcript.append(assistant_msg)

        tool_calls = assistant_msg.get("tool_calls") or []
        if not tool_calls:
            return ChatResponse(status="message", messages=transcript)

        for tc in tool_calls:
            fn = tc.get("function") or {}
            name = fn.get("name", "")
            args = parse_tool_args(fn.get("arguments") or "{}")
            spec = get_tool(name)
            if spec is None:
                transcript.append(
                    _tool_result_message(tc["id"], {"error": f"Unknown tool: {name}"})
                )
                continue
            if spec.is_write:
                summary = await spec.summarize(db, args)  # type: ignore[misc]
                return ChatResponse(
                    status="pending_action",
                    messages=transcript,
                    pending_action=PendingAction(
                        action_id=tc["id"],
                        tool_name=name,
                        arguments=args,
                        summary=summary,
                    ),
                )
            result = await spec.handler(db, args)
            transcript.append(_tool_result_message(tc["id"], result))

    return ChatResponse(
        status="error",
        messages=transcript,
        error="Too many tool iterations; try a simpler question.",
    )


async def execute_pending_action(
    db: AsyncSession,
    messages: list[dict[str, Any]],
    action_id: str,
    decision: str,
    *,
    config: LLMConfig | None = None,
) -> ChatResponse:
    found = _find_pending_tool_call(messages, action_id)
    if not found:
        return ChatResponse(
            status="error",
            messages=messages,
            error="No matching pending action in transcript.",
        )
    _assistant_msg, tc = found
    fn = tc.get("function") or {}
    tool_name = fn.get("name", "")
    args = parse_tool_args(fn.get("arguments") or "{}")

    spec = get_tool(tool_name)
    if spec is None or not spec.is_write:
        return ChatResponse(
            status="error",
            messages=messages,
            error="Invalid or non-write pending action.",
        )

    transcript = list(messages)

    if decision == "reject":
        transcript.append(
            _tool_result_message(
                action_id,
                {"rejected": True, "message": "User rejected this action."},
            )
        )
        return await run_agent_loop(db, transcript, config=config)

    try:
        result = await spec.handler(db, args)
    except Exception as e:
        transcript.append(_tool_result_message(action_id, {"error": str(e)}))
        return await run_agent_loop(db, transcript, config=config)

    transcript.append(_tool_result_message(action_id, result))
    return await run_agent_loop(db, transcript, config=config)
