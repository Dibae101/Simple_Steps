"""
view_tools.py — the Prefab example's tools: views built with prefab-ui.

A tool can return a Prefab component (a ``Card``) or a whole ``PrefabApp``. The
grid shows it as a ``Prefab view · …`` cell, and a click opens the real view
in the cell viewer (docs/spec/015-prefab-views.md). Views are display-only:
tabs, toggles and charts work; actions that call a server (``CallTool``) don't.

Needs prefab-ui (``pip install "simple-steps[prefab]"``); without it each tool
returns that message instead, as its cell's text. prefab-ui is imported inside
the tools, and this file imports nothing from its folder, so the main example
can import it as ``prefab_views.view_tools``.

    simple-steps run examples/prefab_views/app.py
    python examples/prefab_views/runme.py
"""

from __future__ import annotations

from typing import Any

from SIMPLE_STEPS import simple_step_tool
from SIMPLE_STEPS.prefab_pages import prefab_missing

__all__ = ["city_card", "prefab_missing", "readings_board"]


@simple_step_tool(category="Prefab views")
def city_card(city: str, n: int) -> Any:
    """map: a Prefab card for one reading — the city, its n, and a badge.

    Args:
        city: the card's title.
        n: the reading; above 2 is "high".
    """
    missing = prefab_missing()
    if missing:
        return missing
    from prefab_ui.components import (Badge, Card, CardContent, CardDescription,
                                      CardHeader, CardTitle, Metric, Row)

    return Card(children=[
        CardHeader(children=[CardTitle(city), CardDescription("one reading")]),
        CardContent(children=[Row(gap=3, children=[
            Metric(label="n", value=int(n)),
            Badge("high" if n > 2 else "low", variant="success" if n > 2 else "secondary"),
        ])]),
    ])


@simple_step_tool(category="Prefab views")
def readings_board(acc, city: str, n: int) -> Any:
    """collapse: one Prefab dashboard of a whole table — counts, a bar chart
    and the rows.

    Args:
        acc: the board so far — None for the first row.
        city: the row's city.
        n: the row's reading.
    """
    missing = prefab_missing()
    if missing:
        return missing
    from prefab_ui.app import PrefabApp
    from prefab_ui.components import (Column, DataTable, DataTableColumn, Grid,
                                      Heading, Metric, Muted)
    from prefab_ui.components.charts import BarChart, ChartSeries
    from prefab_ui.rx import Rx

    rows = (list(acc.state["rows"]) if acc is not None else []) + [{"city": city, "n": int(n)}]
    values = [r["n"] for r in rows]
    return PrefabApp(title="Readings", state={"rows": rows}, view=Column(gap=4, children=[
        Heading("Readings"),
        Muted(f"{len(rows)} readings from {len({r['city'] for r in rows})} cities"),
        Grid(columns=3, gap=4, children=[
            Metric(label="readings", value=len(rows)),
            Metric(label="total n", value=sum(values)),
            Metric(label="highest n", value=max(values)),
        ]),
        BarChart(data=Rx("rows"), series=[ChartSeries(data_key="n")], x_axis="city"),
        # literal rows: DataTable(rows=Rx(...)) crashes prefab-ui 0.20.2's renderer
        DataTable(columns=[DataTableColumn(key="city", header="city"),
                           DataTableColumn(key="n", header="n")], rows=rows),
    ]))
