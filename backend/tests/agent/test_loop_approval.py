import json
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from caspi.agent.loop import execute_pending_action, run_agent_loop
from caspi.agent.tools.registry import get_tool
from caspi.application.ai_settings import LLMConfig


def _assistant_text(content: str) -> dict:
    return {"role": "assistant", "content": content}


def _assistant_tool_call(tool_call_id: str, name: str, args: dict) -> dict:
    return {
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {
                "id": tool_call_id,
                "type": "function",
                "function": {"name": name, "arguments": json.dumps(args)},
            }
        ],
    }


@pytest.fixture
def llm_config():
    return LLMConfig(model="test/model", api_base=None, api_key="test")


@pytest.mark.asyncio
async def test_read_then_message(monkeypatch, llm_config):
    calls = []

    async def fake_acompletion(_config, messages, *, tools=None):
        calls.append(len(messages))
        if len(calls) == 1:
            return _assistant_tool_call("tc-read", "list_tags", {})
        return _assistant_text("You have 3 tags.")

    monkeypatch.setattr("caspi.agent.loop.acompletion", fake_acompletion)
    db = AsyncMock()
    spec = get_tool("list_tags")
    spec.handler = AsyncMock(return_value={"tags": []})

    resp = await run_agent_loop(db, [{"role": "user", "content": "what tags?"}], config=llm_config)
    assert resp.status == "message"
    assert any(m.get("role") == "tool" for m in resp.messages)


@pytest.mark.asyncio
async def test_write_returns_pending_without_handler(monkeypatch, llm_config):
    executed = []

    async def fake_acompletion(_config, messages, *, tools=None):
        return _assistant_tool_call("tc-write", "create_tag", {"name": "food"})

    async def fake_handler(db, args):
        executed.append(args)
        return {"id": str(uuid4()), "name": "food"}

    monkeypatch.setattr("caspi.agent.loop.acompletion", fake_acompletion)
    db = AsyncMock()
    spec = get_tool("create_tag")
    spec.handler = fake_handler
    spec.summarize = AsyncMock(return_value="Create tag «food»")

    resp = await run_agent_loop(db, [{"role": "user", "content": "create food tag"}], config=llm_config)
    assert resp.status == "pending_action"
    assert resp.pending_action is not None
    assert resp.pending_action.summary == "Create tag «food»"
    assert executed == []


@pytest.mark.asyncio
async def test_approve_executes_and_resumes(monkeypatch, llm_config):
    executed = []

    async def fake_handler(db, args):
        executed.append(args)
        return {"id": str(uuid4()), "name": "food"}

    async def fake_acompletion(_config, messages, *, tools=None):
        if any(m.get("role") == "tool" for m in messages):
            return _assistant_text("Done — created the food tag.")
        return _assistant_tool_call("tc-write", "create_tag", {"name": "food"})

    monkeypatch.setattr("caspi.agent.loop.acompletion", fake_acompletion)
    db = AsyncMock()
    spec = get_tool("create_tag")
    spec.handler = fake_handler
    spec.summarize = AsyncMock(return_value="Create tag «food»")

    pending = await run_agent_loop(
        db, [{"role": "user", "content": "create food tag"}], config=llm_config
    )
    assert pending.status == "pending_action"
    resp = await execute_pending_action(
        db,
        pending.messages,
        pending.pending_action.action_id,  # type: ignore[union-attr]
        "approve",
        config=llm_config,
    )
    assert executed == [{"name": "food"}]
    assert resp.status == "message"


@pytest.mark.asyncio
async def test_reject_no_mutation(monkeypatch, llm_config):
    executed = []

    async def fake_handler(db, args):
        executed.append(args)
        return {}

    async def fake_acompletion(_config, messages, *, tools=None):
        if any(
            m.get("role") == "tool"
            and "rejected" in (m.get("content") or "")
            for m in messages
        ):
            return _assistant_text("Understood, I did not make that change.")
        return _assistant_tool_call("tc-write", "create_tag", {"name": "food"})

    monkeypatch.setattr("caspi.agent.loop.acompletion", fake_acompletion)
    db = AsyncMock()
    spec = get_tool("create_tag")
    spec.handler = fake_handler
    spec.summarize = AsyncMock(return_value="Create tag «food»")

    pending = await run_agent_loop(
        db, [{"role": "user", "content": "create food tag"}], config=llm_config
    )
    await execute_pending_action(
        db,
        pending.messages,
        pending.pending_action.action_id,  # type: ignore[union-attr]
        "reject",
        config=llm_config,
    )
    assert executed == []


@pytest.mark.asyncio
async def test_summarize_error_returns_tool_result_not_500(monkeypatch, llm_config):
    call_count = 0

    async def fake_acompletion(_config, messages, *, tools=None):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return _assistant_tool_call(
                "tc-write",
                "tag_payment",
                {"payment_id": "00000000-0000-0000-0000-000000000001", "tag_name": "ai"},
            )
        return _assistant_text("The tag does not exist yet — create it first with create_tag.")

    monkeypatch.setattr("caspi.agent.loop.acompletion", fake_acompletion)
    db = AsyncMock()
    spec = get_tool("tag_payment")

    async def failing_summarize(_db, _args):
        raise ValueError("Tag not found: ai")

    spec.summarize = failing_summarize

    resp = await run_agent_loop(
        db,
        [{"role": "user", "content": "tag payment with ai"}],
        config=llm_config,
    )
    assert resp.status == "message"
    tool_msgs = [m for m in resp.messages if m.get("role") == "tool"]
    assert any("Tag not found" in (m.get("content") or "") for m in tool_msgs)
