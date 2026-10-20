"""
app.py — the Plotly example as a Simple Steps application.

    simple-steps run examples/plotly_charts/app.py
    python examples/plotly_charts/app.py

Its workflows are in ``workspace/projects/plotly_charts/``. ``runme.py`` runs
them headlessly and checks them.
"""

from pathlib import Path

from SIMPLE_STEPS import App

import chart_tools

app = App(
    tools=[chart_tools],
    workspace=str(Path(__file__).resolve().parent / "workspace"),
    title="Plotly: charts and rich cells",
)

if __name__ == "__main__":
    app.serve()
