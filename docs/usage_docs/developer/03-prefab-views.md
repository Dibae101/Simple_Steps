# 03 — Prefab views in cells

A tool can return more than text, an image or a chart: it can return a
**Prefab view**, a small interface (cards, numbers, a chart, a table, tabs)
written in Python with [prefab-ui](https://github.com/PrefectHQ/prefab). The
grid shows it as `Prefab view · …` with a dashboard icon; clicking the cell
opens the real view. The full rules are in
[spec 015](../../spec/015-prefab-views.md).

## Install

Prefab is optional:

```bash
pip install "simple-steps[prefab]"
```

Without it, everything else works; a tool that builds a view should say how to
install it instead (see `prefab_missing()` below).

## Return a view from a tool

Import prefab-ui inside the tool, so your module still imports without it, and
build the view with keyword arguments: containers take `children=[…]`, and
`Metric` takes `label=` and `value=`.

```python
from SIMPLE_STEPS import simple_step_tool
from SIMPLE_STEPS.prefab_pages import prefab_missing

@simple_step_tool(category="Views")
def city_card(city: str, n: int):
    """map: a card for one reading.

    Args:
        city: the card's title.
        n: the reading.
    """
    if (missing := prefab_missing()):
        return missing
    from prefab_ui.components import Card, CardContent, CardHeader, CardTitle, Metric
    return Card(children=[
        CardHeader(children=[CardTitle(city)]),
        CardContent(children=[Metric(label="n", value=int(n))]),
    ])
```

Used as `=city_card[mod.map(name="card")](wf["readings"])`, every row gets a
card. For one view of a whole table, write a reducer and use `mod.collapse()`:
it is called once per row with the view so far as `acc` (`None` for the first
row) and returns a `PrefabApp`. The shipped example does exactly this:
[`examples/prefab_views/view_tools.py`](../../../src/SIMPLE_STEPS/examples/prefab_views/view_tools.py).

The grid names a view by a `PrefabApp`'s `title`, or by its root component and
first title or heading (`Prefab view · Card · SF`).

## What works, and what doesn't

Views are **display-only**. They run in a sandboxed frame that can't reach the
app, its cookies or its API.

- Works: layout, text, `Metric`, `Badge`, `DataTable`, charts, tabs, toggles,
  sliders — anything driven by the view's own state.
- Does nothing: `CallTool` and `SendMessage` (they need an MCP host, which
  Simple Steps isn't), `OpenLink` and downloads (blocked by the sandbox).
- With prefab-ui 0.20.2, give `DataTable` literal `rows=[…]`: `rows=Rx(…)`
  crashes its renderer (`BarChart(data=Rx(…))` is fine). If a view does fail,
  the viewer says so above the frame.
- Prefab fills in `{{ … }}` in every string of a view from its state, so text
  that should show braces literally needs care.

## How it is shown

The viewer asks the server for the cell; the server builds the page with
prefab-ui's own export (`PrefabApp.html()`, what `prefab export` writes) and
the viewer puts it in an iframe. The renderer it loads is served by Simple
Steps from the installed prefab-ui, so views work offline and always match the
installed version (the `prefab` extra pins it exactly). The first view you open
downloads the renderer (about 6 MB); after that it is cached.
