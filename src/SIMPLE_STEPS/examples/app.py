"""
app.py — the main example: every sub-example's tools in one application.

    simple-steps run examples/app.py
    python examples/app.py

It imports the tools of ``basic/``, ``dummy_llm/``, ``plotly_charts/`` and
``bad_examples/`` and offers their resources, so one workflow can use them:
``workspace/projects/main/all-examples.simple-steps-workflow``. ``runme.py``
runs every sub-example's checks, then that workflow's.
"""

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# Each sub-example imports its own modules by name (`import basic_tools`), so
# its folder goes on the import path. The module names are unique across the
# examples, so nothing is imported twice under one name.
for sub in ("basic", "dummy_llm", "plotly_charts", "bad_examples"):
    if str(HERE / sub) not in sys.path:
        sys.path.insert(0, str(HERE / sub))

from SIMPLE_STEPS import App  # noqa: E402

import bad_tools  # noqa: E402
import basic_tools  # noqa: E402
import chart_tools  # noqa: E402
import llm_tools  # noqa: E402
from llm_resources import TYPES, ready_made  # noqa: E402

app = App(
    tools=[basic_tools, llm_tools, chart_tools, bad_tools],
    resources=TYPES,
    loaded=ready_made(),
    workspace=str(HERE / "workspace"),
    title="All examples",
)

if __name__ == "__main__":
    app.serve()
