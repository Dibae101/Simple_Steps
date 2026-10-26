"""
app.py — the Prefab example as a Simple Steps application.

    simple-steps run examples/prefab_views/app.py
    python examples/prefab_views/app.py

Its workflow is in ``workspace/projects/prefab_views/``. ``runme.py`` runs it
headlessly and checks it. Needs prefab-ui: ``pip install "simple-steps[prefab]"``.
"""

from pathlib import Path

from SIMPLE_STEPS import App

import view_tools

app = App(
    tools=[view_tools],
    workspace=str(Path(__file__).resolve().parent / "workspace"),
    title="Prefab: views in cells",
)

if __name__ == "__main__":
    app.serve()
