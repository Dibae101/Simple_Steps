"""
llm_tools.py — the dummy LLM example's resources and tools.

A *resource* is an object tools use that isn't data: a database connection,
a language model. Here every one is a deterministic dummy, so a workflow's
output can be checked exactly:

- ``FakeDB`` — an in-memory city → region table, with a bound ``lookup``;
- ``FakeLLM`` / ``TinyLLM`` — models that answer ``[model] PROMPT``, with a
  bound ``complete``;
- ``enrich`` / ``summarize`` — unbound tools that take a resource argument;
- ``OllamaLLM`` — a real model, served by Ollama, offered only when one runs.

``TYPES`` and ``ready_made()`` are what an app offers from this file: the
dummy example's ``app.py`` and the main example's both use them. The file
imports nothing from its folder, so the main example can import it as
``dummy_llm.llm_tools``.

    simple-steps run examples/dummy_llm/app.py
    python examples/dummy_llm/runme.py
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

from SIMPLE_STEPS import Loaded, simple_step_resource, simple_step_tool


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
    local model (``OllamaLLM``, below).
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


# ─────────────────────────────────────────────────────────────────────────
# A real language model: a local Ollama model (optional)
#
# ``OllamaLLM`` talks to Ollama's HTTP API (https://ollama.com) with the
# standard library, so it needs no extra package. It's offered as the
# ready-made ``res["local_llm"]`` only when it can be loaded: Ollama is
# running and has the model. A small model is plenty — the default,
# ``llama3.2:3b`` (about 2 GB):
#
#     ollama pull llama3.2:3b
#     ollama serve                 # if the Ollama app isn't already running
#
# Override the model or the server with ``OLLAMA_MODEL`` / ``OLLAMA_HOST``.
# ─────────────────────────────────────────────────────────────────────────

#: The model and server, unless the environment says otherwise.
DEFAULT_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")
DEFAULT_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")


def _url(host: str, path: str) -> str:
    host = host if host.startswith("http") else f"http://{host}"
    return host.rstrip("/") + path


def ollama_available(model: str = DEFAULT_MODEL, host: str = DEFAULT_HOST,
                     timeout: float = 1.5) -> tuple[bool, str]:
    """Whether Ollama answers at *host* and has *model*: ``(ok, why not)``."""
    try:
        with urllib.request.urlopen(_url(host, "/api/tags"), timeout=timeout) as response:
            tags = json.loads(response.read())
    except (urllib.error.URLError, OSError, ValueError) as exc:
        reason = getattr(exc, "reason", exc)
        return False, f"Ollama isn't answering at {host} ({reason})"
    names = {m.get("name", "") for m in tags.get("models", [])}
    wanted = {model, f"{model}:latest"} if ":" not in model else {model}
    if not names & wanted:
        have = ", ".join(sorted(names)) or "none"
        return False, f"Ollama doesn't have {model} (it has: {have}); run: ollama pull {model}"
    return True, ""


@simple_step_resource
class OllamaLLM(LLM):
    """A local language model served by Ollama.

    Fits any tool that takes an ``LLM`` (``summarize``), and offers
    ``complete`` as a bound tool: ``res["local_llm"].complete(prompt="…")``.
    """

    def __init__(self, model: str = DEFAULT_MODEL, host: str = DEFAULT_HOST,
                 temperature: float = 0.0, timeout: float = 120.0):
        self.model = model
        self.host = host
        self.temperature = temperature
        self.timeout = timeout

    @simple_step_tool
    def complete(self, prompt: str) -> str:
        """One completion from the local model.

        Args:
            prompt: the text to send to the model.
        """
        body = json.dumps({
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            # temperature 0 and a fixed seed keep a re-run's answer stable.
            "options": {"temperature": self.temperature, "seed": 0},
        }).encode()
        request = urllib.request.Request(
            _url(self.host, "/api/generate"), data=body,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read()).get("response", "").strip()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")[:200]
            raise RuntimeError(f"Ollama refused the request ({exc.code}): {detail}") from None
        except (urllib.error.URLError, OSError) as exc:
            raise RuntimeError(
                f"Ollama isn't answering at {self.host}: {getattr(exc, 'reason', exc)}"
            ) from None


# ─────────────────────────────────────────────────────────────────────────
# What an app offers from this file
# ─────────────────────────────────────────────────────────────────────────

#: Resource types users may create. OllamaLLM is offered either way, so a user
#: can point one at another server.
TYPES = [FakeDB, FakeLLM, TinyLLM, OllamaLLM]


def ready_made() -> dict:
    """The resources the app provides by name. A real deployment reads
    credentials with ``env("NAME")``, which workflows never see."""
    loaded = {"house_llm": Loaded(FakeLLM, model="house-1")}
    ok, why_not = ollama_available(DEFAULT_MODEL, DEFAULT_HOST)
    if ok:
        loaded["local_llm"] = Loaded(OllamaLLM, model=DEFAULT_MODEL, host=DEFAULT_HOST)
    else:
        print(f"  ⓘ  local_llm not loaded: {why_not}")
    return loaded


def local_llm_missing() -> str | None:
    """Why the local model can't run, or None when it can."""
    ok, why_not = ollama_available(DEFAULT_MODEL, DEFAULT_HOST)
    return None if ok else f"{why_not} (see llm_tools.py: Ollama, ollama pull …)"
