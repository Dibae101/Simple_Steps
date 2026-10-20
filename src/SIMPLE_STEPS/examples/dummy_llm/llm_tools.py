"""
llm_tools.py — the dummy LLM example's resources and tools.

A *resource* is an object tools use that isn't data: a database connection,
a language model. Here every one is a deterministic dummy, so a workflow's
output can be checked exactly:

- ``FakeDB`` — an in-memory city → region table, with a bound ``lookup``;
- ``FakeLLM`` / ``TinyLLM`` — models that answer ``[model] PROMPT``, with a
  bound ``complete``;
- ``enrich`` / ``summarize`` — unbound tools that take a resource argument.

``local_llm.py`` adds a real model, Ollama's, when one is running.

    simple-steps run examples/dummy_llm/app.py
    python examples/dummy_llm/runme.py
"""

from __future__ import annotations

from SIMPLE_STEPS import simple_step_resource, simple_step_tool


# ─────────────────────────────────────────────────────────────────────────
# Resources — core's ``build_resources()`` example (core-proposals/007).
#
#   @simple_step_resource  on a class: a resource type, built from literal
#                          settings (core's @resource).
#   @simple_step_tool      on one of its methods: a BOUND tool, written
#                          res["db"].lookup[mod.map()](wf["keys"]). The method
#                          stays an ordinary method (core's @bound_tool).
#   @simple_step_tool      on a function with a resource-typed parameter: an
#                          UNBOUND tool, written
#                          enrich[mod.map()](wf["readings"], db=res["db"]).
#
# An unmarked method (FakeDB.reset) is never a tool, though tool code may call
# it. The workflow declares which instances exist in its `resources` section
# (workspace/projects/dummy_llm/resources.simple-steps-workflow); the app builds each one on
# first use, once per session.
# ─────────────────────────────────────────────────────────────────────────


@simple_step_resource
class FakeDB:
    """An in-memory table: city -> region."""

    def __init__(self, table: dict | None = None):
        self.table = dict(table or {"SF": "west", "NYC": "east", "LA": "west"})
        self.reads = 0

    @simple_step_tool
    def lookup(self, key: str) -> str | None:
        """The region stored for a key, or None.

        Args:
            key: the city to look up.
        """
        self.reads += 1
        return self.table.get(key)

    def reset(self) -> None:                      # unmarked: never a tool
        self.reads = 0


class LLM:
    """Any language model: something with ``complete(prompt) -> str``.

    A base type, not a resource type itself: a tool that takes ``llm: LLM``
    accepts every resource that is one — the dummy ``FakeLLM`` here, or a real
    local model (``OllamaLLM`` in ``local_llm.py``).
    """

    def complete(self, prompt: str) -> str:
        raise NotImplementedError


@simple_step_resource
class FakeLLM(LLM):
    """Answers deterministically: the model name, then the prompt upper-cased."""

    def __init__(self, model: str = "fake-1"):
        self.model = model
        self.calls = 0

    @simple_step_tool
    def complete(self, prompt: str) -> str:
        """One completion for a prompt.

        Args:
            prompt: the text to complete.
        """
        self.calls += 1
        return f"[{self.model}] {prompt.upper()}"


@simple_step_resource
class TinyLLM(FakeLLM):
    """A smaller FakeLLM — fits anywhere a FakeLLM is asked for."""


@simple_step_tool(category="Dummy LLM")
def enrich(city: str, db: FakeDB) -> str:
    """unbound: the region for a city, read from the database.

    Args:
        city: the city to look up.
        db: the database to read.
    """
    return db.lookup(city) or "unknown"


@simple_step_tool(category="Dummy LLM")
def summarize(text: str, llm: LLM) -> str:
    """unbound: one line from the model — any LLM, fake or real.

    Args:
        text: the text to summarize.
        llm: the model to ask.
    """
    return llm.complete(text)
