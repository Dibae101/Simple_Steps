# Test plan: Prefab views in cells (spec 015)

Which checks cover each requirement of
[spec 015](../spec/015-prefab-views.md), and where they run. The phase rules in
`docs/context.md` keep `tests/**` for the TESTS phase, so the backend's pytest
cases are listed here for that phase; everything else runs now.

## Run now

| test | requirement | where |
|---|---|---|
| TEST-PFB-10 an opened view is one iframe, `sandbox="allow-scripts"` only, the page as `srcdoc` | REQ-PFB-010 | `frontend/src/components/CellViewer.prefab.test.tsx` |
| TEST-PFB-11 the grid shows the `dashboard` icon and the summary, no iframe, no fetch | REQ-PFB-010, REQ-PFB-013 | same |
| TEST-PFB-12 no page shows the error text; a report from the frame shows the banner; from another window, or the renderer's handshake, nothing | REQ-PFB-012 | same |
| TEST-PFB-20 the example's layout and workflow run through the app and match the Python twin | REQ-PFB-020, REQ-PFB-024 | `src/SIMPLE_STEPS/examples/prefab_views/runme.py` |
| TEST-PFB-21 every card's summary is `Prefab view · Card · <city>`; the board holds the three counts, one chart and the rows | REQ-PFB-002, REQ-PFB-021 | same |
| TEST-PFB-22 without prefab-ui the workflow is skipped with the install message, and the main example's board is that message | REQ-PFB-022 | same, and `src/SIMPLE_STEPS/examples/runme.py` (`board_or_hint`) |
| TEST-PFB-23 `all-examples` runs its `board` step and matches its twin | REQ-PFB-023 | `src/SIMPLE_STEPS/examples/runme.py` (also `TEST-EX-02` in `tests/test_examples.py`) |
| TEST-PFB-04 the board's page loads this app's renderer and is the same page when opened twice; the renderer splits into a script and a stylesheet | REQ-PFB-004, REQ-PFB-005 | `src/SIMPLE_STEPS/examples/prefab_views/runme.py` (`board`) |
| TEST-PFB-31 the workflow exports as one page: renderer pinned to the installed prefab-ui, strict JSON, `{{` shown literally, titles escaped, the views inlined, a step that never ran marked | REQ-PFB-031 | `src/SIMPLE_STEPS/examples/prefab_views/runme.py` (`check_export`) |
| TEST-PFB-32 the menu entry is absent unless wired, disabled without output, and calls the handler | REQ-PFB-032 | `frontend/src/components/MenuBar.prefab.test.tsx` |

By hand, in headless Chromium: a parent page that fetches `/api/cell` and sets
the frame's `srcdoc`, as the viewer does, renders the card and the dashboard
in sandboxed frames (origin `null`) with no report; `renderer.js` and
`renderer.css` answer `Origin: null` with `Access-Control-Allow-Origin: *`,
their content types and `nosniff`, and no `Set-Cookie`. An exported page
opened from disk draws every step, the dashboard's chart with its bars, and a
title written as markup shown as text.

## TESTS phase (`tests/test_prefab_views.py`)

| test | requirement |
|---|---|
| TEST-PFB-01 detection: components, apps and subclasses match; a Plotly figure, a dict and a pydantic model don't; `SIMPLE_STEPS.main` imports with `sys.modules["prefab_ui"] = None` | REQ-PFB-001 |
| TEST-PFB-02 summary and label rules (title, `"Prefab"`, first heading, 60-character cut, never raises); `cell()` shape | REQ-PFB-002 |
| TEST-PFB-03 payload: strict JSON with NaN repaired, `<` escaped, reporter first in `<head>`, escaped `<title>`, the caller's object untouched (a context-manager app's root `Div` isn't stamped); error payload | REQ-PFB-003, REQ-PFB-004 |
| TEST-PFB-05 renderer route: content types, CORS, cache, `nosniff`, no `Set-Cookie`, 404 for another name or version | REQ-PFB-005 |
| TEST-PFB-24 `same()` on equal and different views, and a view against a non-view | REQ-PFB-024 |
| TEST-PFB-30 export route: 200 attachment and filename, 422 for nothing run and for a path-like ref, 501 without prefab-ui, another session's ref not included | REQ-PFB-030 |
| `prefab_views` in `test_sub_example_runme_passes` | REQ-PFB-020 |
