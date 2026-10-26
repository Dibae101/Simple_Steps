# Specification: Prefab views in cells

A tool can return a [Prefab](https://github.com/PrefectHQ/prefab) view — a
component tree written in Python with `prefab-ui` — and the user sees it in
the app: as a typed cell in the grid, and as the real, interactive view when
the cell is opened. Prefab is optional (the `prefab` extra), display-only, and
never drawn inside the grid.

Why only there: Prefab's renderer is a prebuilt React 19 app that runs in its
own page, not React components the app could import (the app is React 18). So
a view runs in an iframe, about 6 MB of JavaScript each, which fits one opened
cell, not hundreds of grid cells. The same rule already holds for charts: the
grid shows a summary, the viewer draws the figure.

## Cell type

- **REQ-PFB-001** A value whose class's MRO contains `prefab_ui.app.PrefabApp`
  or `prefab_ui.components.base.Component` (matched by module and class name;
  `prefab_ui` is never imported to check) is a `prefab` cell, ahead of `json`
  (a component has `model_dump` and would otherwise become a lossy dict).
  Subclasses count.
- **REQ-PFB-002** Its grid cell: `cell_type "prefab"`, `summary` =
  `display_value` = `Prefab view · <label>`, `value null`, no preview. The
  label is a `PrefabApp`'s title unless it is blank or `"Prefab"`; otherwise
  the root component's class name, plus ` · <text>` of its first `CardTitle`,
  `Heading` or `H1`–`H4` (depth first, at most 200 nodes). The label is cut to
  60 characters. The summary never raises; on any error it is `Prefab view`.
- **REQ-PFB-003** Its viewer payload is `{"kind": "prefab", "html": <page>,
  "title": <label>}`, or `{"kind": "prefab", "html": null, "title": …,
  "error": "<Type>: <message>"}` when no page can be built.
- **REQ-PFB-004** The page is prefab-ui's own export, `PrefabApp.html()` (a bare
  component is wrapped as `PrefabApp(title=<label>, view=component)`), with:
  the renderer loaded from this app (REQ-PFB-005); the `<title>` HTML-escaped;
  the baked data made strict JSON (NaN and ±Inf become `null`, every `<`
  escaped); a reporter script first in `<head>` (REQ-PFB-012). It is built from
  a copy, so opening a view never changes the step's stored output, and the
  same value always gives the same page.
- **REQ-PFB-005** `GET /api/prefab/renderer/{version}/{name}` serves
  `renderer.js` (`text/javascript`) and `renderer.css` (`text/css`), split out
  of the installed package's bundled renderer, with
  `Access-Control-Allow-Origin: *` (a sandboxed iframe sends `Origin: null`,
  and module scripts need CORS), `Cache-Control: public, max-age=31536000,
  immutable` and `X-Content-Type-Options: nosniff`. It reads no session and
  sets no cookie. Any other name, a version other than the installed one, or
  no prefab-ui: 404. The page refers to it by a relative URL, so it works from
  the bundled UI and through the Vite dev proxy alike, and offline.

## Viewer and grid

- **REQ-PFB-010** An opened `prefab` view is one `<iframe sandbox="allow-scripts"
  srcdoc=…>`, never `allow-same-origin`, so a view can't reach the app, its
  cookies or its API. Grid cells show only the icon and the summary.
- **REQ-PFB-011** The frame is 480 px tall inline and fills the viewer when the
  viewer has a size of its own (pulled off, expanded, the selection popover).
- **REQ-PFB-012** No page: the viewer shows `Couldn't show this Prefab view:
  <error>`. The page's reporter posts `{source: "simple-steps-prefab", type:
  "error", message}` to its parent when the renderer can't load or crashes (not
  for a broken image inside a view, nor the benign ResizeObserver notice); the
  viewer then shows `The Prefab view failed in its renderer: <message>` above
  the frame, as text. A message from any other window is ignored, as is the
  renderer's own `ui/initialize`.
- **REQ-PFB-013** The grid's icon for `prefab` is Material Symbols `dashboard`.
- **Display-only.** Client-side state works (tabs, toggles, sliders, charts).
  Actions that need an MCP host (`CallTool`, `SendMessage`) do nothing; there is
  no host handshake, so a view doesn't resize itself. `OpenLink` and downloads
  are blocked by the sandbox.

## Example

- **REQ-PFB-020** `src/SIMPLE_STEPS/examples/prefab_views/` follows the
  sub-example layout: `__init__.py`, `view_tools.py`, `app.py`,
  `view_pipeline.py`, `runme.py`, `README.md` and
  `workspace/projects/prefab_views/views.simple-steps-workflow`.
- **REQ-PFB-021** `city_card(city, n)` under `mod.map(name="card")` returns a
  `Card` per row; `readings_board(acc, city, n)` under `mod.collapse()` returns
  one `PrefabApp` with three `Metric`s, a `BarChart` and a `DataTable` (`acc` is
  `None` for the first row).
- **REQ-PFB-022** Without prefab-ui both tools return `Prefab views need
  prefab-ui: pip install "simple-steps[prefab]"` as their cell's text, and the
  example's `runme.py` skips its workflow with that reason.
- **REQ-PFB-023** The main example imports `view_tools`, `SUB_EXAMPLES` lists
  `prefab_views`, and `all-examples` gains `board =
  readings_board[mod.collapse()](wf["big"])`.
- **REQ-PFB-024** `example_check.same()` compares Prefab values by their wire
  JSON (plus a `PrefabApp`'s title).

## Packaging and docs

- **REQ-PFB-040** The extra `prefab = ["prefab-ui==0.20.2"]`, pinned exactly
  (the viewer serves this package's renderer); `dev` includes it.
- **REQ-PFB-041** This spec, `docs/testplan/015-prefab-views.md`, the developer
  page `docs/usage_docs/developer/03-prefab-views.md`, and the examples README.

## Out of scope

Prefab actions that need an MCP host, and a host handshake (so no auto-height);
live views in grid cells; core changes. Upgrading prefab-ui means re-checking
REQ-PFB-004/005: the page builder relies on the bundled renderer being one
module script and one style, and on `renderer_mode` accepting a URL (the path
prefab's own `PREFAB_RENDERER_URL` override takes). Both are checked at run
time and fail with a readable error.
