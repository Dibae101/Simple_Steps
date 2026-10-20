"""
app.py — the dummy LLM example as a Simple Steps application.

    simple-steps run examples/dummy_llm/app.py
    python examples/dummy_llm/app.py

Its workflows are in ``workspace/projects/dummy_llm/``. ``runme.py`` runs
them headlessly and checks them.
"""

from pathlib import Path

from SIMPLE_STEPS import App

import llm_tools
from llm_resources import TYPES, ready_made

app = App(
    tools=[llm_tools],
    resources=TYPES,
    loaded=ready_made(),
    workspace=str(Path(__file__).resolve().parent / "workspace"),
    title="Dummy LLM: resources",
)

if __name__ == "__main__":
    app.serve()
