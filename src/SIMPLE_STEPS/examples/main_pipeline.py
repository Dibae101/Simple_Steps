"""
main_pipeline.py — the main example's workflow, written in Python.

The twin of ``workspace/projects/main/all-examples.simple-steps-workflow``:
one Python line per saved step, using tools from all three sub-examples.
``runme.py`` runs both and checks every step's output is the same.

Import this after the app (``runme.py`` does): the tools come from it.
"""

from __future__ import annotations

from simple_steps_core import grid
from simple_steps_core.grid import mod, res

from SIMPLE_STEPS.example_check import tool_handles

# The resource types the app registered (dummy_llm's), by name. Importing
# llm_tools directly works only once app.py has put dummy_llm/ on the import
# path, which an editor can't see.
FakeDB, FakeLLM = grid.resource_types()["FakeDB"], grid.resource_types()["FakeLLM"]

to_rows, identity = tool_handles("to_rows", "identity")
scale, is_big, add_n = tool_handles("scale", "is_big", "add_n")          # basic
enrich, summarize = tool_handles("enrich", "summarize")                 # dummy_llm
swatch, bar_chart = tool_handles("swatch", "bar_chart")                 # plotly_charts


def build_all_examples() -> grid.Workflow:
    """``all-examples``: readings scored and filtered (basic), looked up and
    summarized by resources (dummy_llm), then drawn (plotly_charts)."""
    wf = grid.Workflow()
    wf.define("db", FakeDB)
    wf.define("llm", FakeLLM, model="main-1")

    wf["readings"] = to_rows[mod.source()](data='{"city": ["SF", "NYC", "LA", "SF"], "n": [1, 4, 2, 3]}')

    # basic: a map, then a filter
    wf["scored"] = scale[mod.map(name="score")](wf["readings"])
    wf["big"] = is_big[mod.filter()](wf["scored"])

    # dummy_llm: a database lookup, then a model's summary, per row
    wf["regions"] = enrich[mod.map(name="region")](wf["big"], db=res["db"])
    wf["texts"] = identity[mod.rename(columns={"city": "text"})](wf["regions"])
    wf["summaries"] = summarize[mod.map(name="summary")](wf["texts"], llm=res["llm"])

    # basic again: a reducer over the filtered rows
    wf["total_n"] = add_n[mod.collapse(initial=0)](wf["big"])

    # plotly_charts: an image per row, and one chart of them all
    wf["swatches"] = swatch[mod.map(name="swatch")](wf["big"])
    wf["chart"] = bar_chart[mod.collapse()](wf["big"])
    return wf


def live_resources() -> dict:
    """The objects the twin runs with."""
    return {"db": FakeDB(), "llm": FakeLLM(model="main-1")}
