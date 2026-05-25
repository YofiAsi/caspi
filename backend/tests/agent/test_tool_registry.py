from caspi.agent.tools import reads as _reads  # noqa: F401
from caspi.agent.tools import writes as _writes  # noqa: F401
from caspi.agent.tools.registry import TOOLS, tools_openai_schema


def test_tool_names_unique():
    names = [t.name for t in TOOLS]
    assert len(names) == len(set(names))


def test_summarize_invariant():
    for t in TOOLS:
        if t.is_write:
            assert t.summarize is not None
        else:
            assert t.summarize is None


def test_openai_schema_has_all_tools():
    schema = tools_openai_schema()
    assert len(schema) == len(TOOLS)
    for entry, spec in zip(schema, TOOLS, strict=True):
        assert entry["function"]["name"] == spec.name
