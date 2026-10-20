"""
app.py — the basic example as a Simple Steps application.

    simple-steps run examples/basic/app.py   # serve it, like `streamlit run`
    python examples/basic/app.py             # the same, via app.serve()

Its workflows are in ``workspace/projects/basic/``; open one from the file
explorer and run it. ``runme.py`` runs them headlessly and checks them.
"""

from pathlib import Path

from SIMPLE_STEPS import App

import basic_tools

app = App(
    tools=[basic_tools],
    workspace=str(Path(__file__).resolve().parent / "workspace"),
    title="Basic: core verbs and data manipulation",
)

if __name__ == "__main__":
    app.serve()
