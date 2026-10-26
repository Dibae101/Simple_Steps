"""
view_pipeline.py — the Prefab example's workflow, written in Python.

The twin of ``workspace/projects/prefab_views/views.simple-steps-workflow``:
one Python line per saved step, in simple-steps-core's syntax. ``runme.py``
runs both and checks every step's output is the same — Prefab views compared
by their wire JSON.
"""

from __future__ import annotations

from simple_steps_core import grid
from simple_steps_core.grid import mod

from SIMPLE_STEPS.operations import to_rows
from view_tools import city_card, readings_board


def build_views() -> grid.Workflow:
    """``views``: a Prefab card per reading, then one dashboard of them all."""
    wf = grid.Workflow()
    wf["readings"] = to_rows[mod.source()](data='{"city": ["SF", "NYC", "LA", "SF"], "n": [1, 4, 2, 3]}')
    wf["cards"] = city_card[mod.map(name="card")](wf["readings"])
    wf["board"] = readings_board[mod.collapse()](wf["readings"])
    return wf
