from caspi.agent.llm import _strip_thinking_content, normalize_assistant_message


def test_strip_thinking_json():
    assert _strip_thinking_content('{"thinking": "I will list tags"}') is None


def test_keep_normal_text():
    assert _strip_thinking_content("Your top merchant is Coffee Shop.") == "Your top merchant is Coffee Shop."


def test_normalize_assistant_strips_thinking():
    msg = normalize_assistant_message(
        {"role": "assistant", "content": '{"thinking": "planning"}', "tool_calls": None}
    )
    assert msg["content"] is None
