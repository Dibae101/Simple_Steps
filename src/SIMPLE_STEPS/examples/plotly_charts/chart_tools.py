"""
chart_tools.py — the Plotly example's tools: charts and other rich cells.

A tool can return more than text: a Plotly figure, an image (a uint8 numpy
array), or a whole table. The grid shows each as a thumbnail or summary, a
click opens the full view, and a later step reads the real object.

    simple-steps run examples/plotly_charts/app.py
    python examples/plotly_charts/runme.py

(The folder isn't called ``plotly``: the main example imports it as a package
from the examples folder, where it would hide the plotly library itself.)
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from SIMPLE_STEPS import simple_step_tool


# ─────────────────────────────────────────────────────────────────────────
# Rich cells — values the grid shows as more than text (docs/dev_plan/122 §4).
# An image, a Plotly figure and a table, each in a cell: the grid shows a
# thumbnail or a summary, and a click opens the full view. A later step reads
# the real object — `brightness` gets the image array, not its thumbnail.
# ─────────────────────────────────────────────────────────────────────────


@simple_step_tool(category="Plotly charts")
def swatch(n: int) -> np.ndarray:
    """A 16×16 colour swatch for a reading: redder as n grows. A uint8 array
    is shown as an image, with no imaging library needed.

    Args:
        n: the reading.
    """
    image = np.zeros((16, 16, 3), dtype=np.uint8)
    image[..., 0] = min(255, 60 * n)
    image[..., 2] = 128
    return image


@simple_step_tool(category="Plotly charts")
def brightness(swatch: np.ndarray) -> float:
    """The mean pixel value of an image — reads the real array.

    Args:
        swatch: an image from a previous step.
    """
    return round(float(swatch.mean()), 2)


@simple_step_tool(category="Plotly charts")
def profile(city: str, n: int) -> pd.DataFrame:
    """A one-row table about a reading, shown as a table in a cell.

    Args:
        city: the city.
        n: the reading.
    """
    return pd.DataFrame({"city": [city], "n": [n], "double": [2 * n]})


@simple_step_tool(category="Plotly charts")
def city_chart(cities: list, counts: list):
    """A Plotly bar chart (Plotly is installed with Simple Steps).

    Args:
        cities: the bars' labels.
        counts: the bars' heights.
    """
    import plotly.graph_objects as go
    return go.Figure(go.Bar(x=cities, y=counts), layout_title_text="Readings per city")


@simple_step_tool(category="Plotly charts")
def above_one(n: float) -> bool:
    """filter: keep the rows worth charting — those whose n is above one.

    Args:
        n: the reading.
    """
    return n > 1


@simple_step_tool(category="Plotly charts")
def bar_chart(acc, city: str, n: float):
    """collapse: a Plotly bar chart of a whole table, one bar per row.

    A reducer: core calls it once per row with the chart so far, so a table
    from another step becomes one figure.

    Args:
        acc: the chart so far — None for the first row.
        city: the bar's label.
        n: the bar's height.
    """
    import plotly.graph_objects as go
    fig = acc if acc is not None else go.Figure(go.Bar(x=[], y=[]), layout_title_text="Readings above one")
    bar = fig.data[0]
    bar.x = (*bar.x, city)
    bar.y = (*bar.y, n)
    return fig
