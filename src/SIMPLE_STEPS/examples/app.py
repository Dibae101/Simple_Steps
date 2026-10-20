"""
app.py — the main example: every sub-example's tools in one application.

    simple-steps run examples/app.py
    python examples/app.py

It imports the tools of ``basic/``, ``dummy_llm/``, ``plotly_charts/`` and
``bad_examples/`` and offers their resources, so one workflow can use them:
``workspace/projects/main/all-examples.simple-steps-workflow``. ``runme.py``
runs every sub-example's checks, then that workflow's.

Each sub-example folder is a package, imported from here like any other.
"""

from pathlib import Path

from SIMPLE_STEPS import App

from bad_examples import bad_tools
from basic import basic_tools
from dummy_llm import llm_tools
from plotly_charts import chart_tools

app = App(
    tools=[basic_tools, llm_tools, chart_tools, bad_tools],
    resources=llm_tools.TYPES,
    loaded=llm_tools.ready_made(),
    workspace=str(Path(__file__).resolve().parent / "workspace"),
    title="All examples",
)

if __name__ == "__main__":
    app.serve()
