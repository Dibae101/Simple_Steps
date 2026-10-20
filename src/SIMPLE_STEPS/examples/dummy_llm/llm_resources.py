"""
llm_resources.py — what the dummy LLM example offers as resources.

``TYPES`` are the resource types a user may create from the Resources menu.
``ready_made()`` are resources the app provides by name: the dummy
``house_llm`` always, and ``local_llm`` — a real model, see ``local_llm.py`` —
only when Ollama is running and has the model.

The main example (``examples/app.py``) offers the same, so its workflow can
use them too.
"""

from __future__ import annotations

from SIMPLE_STEPS import Loaded

from llm_tools import FakeDB, FakeLLM, TinyLLM
from local_llm import DEFAULT_HOST, DEFAULT_MODEL, OllamaLLM, ollama_available

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
    return None if ok else f"{why_not} (see local_llm.py: Ollama, ollama pull …)"
