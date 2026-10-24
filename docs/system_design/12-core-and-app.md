# Core and app: the separation

> As built on 2026-10-23, app on core `86170a3`. What `simple-steps-core`
> owns, what this repo owns, the rules at the line between them, and how a
> change crosses it. Objects: [object model](10-object-model.md); traffic:
> [data flow and storage](11-data-flow-and-storage.md).

## The split in one picture

```
┌──────────────────────────── Simple Steps (this repo) ────────────────────────────┐
│  Browser UI (frontend/)        grid, selection, inspector, formula bar, console  │
│        │ HTTP / SSE                                                               │
│  Server (src/SIMPLE_STEPS/)    App · HTTP API · kernels · storage · cell views   │
│        │                       workflow files · resources' live objects · agent  │
│        │  core_bridge.py — the only place core's gaps are patched (SHIMs)         │
└────────┼──────────────────────────────────────────────────────────────────────────┘
         ▼
┌──────────────────── simple-steps-core (external/, read-only) ─────────────────────┐
│  grid.Workflow · Step · Operation · Modifier · Output · tools · references         │
│  checking · running · cell states · versions & staleness · previews · save format  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

**Core is the engine; the app is the server and the UI around it** — the way
Jupyter Server and JupyterLab sit around a kernel. Core decides what a
workflow *means* and what its results *are*. The app decides how people write,
run, see and keep them.

## Who owns what

| Concern | Core | App |
|---|---|---|
| What a step means: verbs, modifiers, arguments, references, combiners | **owns** (`Operation`, `Modifier`, `mod.*`, `zip_`, `join`, `stack`) | writes formulas that use them |
| Checking a step before it runs (problems, warnings) | **owns** | shows them; keeps the old path's wording where an example's lesson depends on it |
| Running: per row, retries, timeouts, failures, what stops a run | **owns** | calls `wf.run`, reports the result |
| Cell states, step status | **owns** (`Output.states`, `step.status`) | draws them (phase 3) |
| Row numbers `#`, row links, column numbers, selections | **owns** | the selection UI; writes selections into formulas |
| Versions and staleness | **owns** (`version`, `read`, `stale_reason`) | asks after every edit; shows "out of date" |
| Previews of what a step will produce (`plan`, `wf.preview`, `wf.cell`) | **owns** | the grid and inspector (phase 3) |
| Saving a workflow and its outputs | **owns the format** (`to_dict`, `to_session_dict`, `from_dict`) | decides when and where: kernels put away to disk |
| Tools | **owns the contract** (`@tool`, `grid.catalog()`) | `@simple_step_tool` registers a tool with core *and* the UI's catalog; the palette |
| Resources | **owns** declaring and checking (`define`, `ResourceDecl`) | offers resource types, builds and keeps the live objects per session (`resources.py`), the settings UI |
| Formula text | defines the syntax (`tool[mod.verb(…)](wf["x"], …)`) and **prints** it: `Operation.to_source()`. It has no parser — in Python a formula is real code that builds the Operation | **parses** the text into core's operation (`operation_formula.py`, checking verbs against `grid.modifier_catalog()`), the editor, autocomplete, syntax help |
| Kernels, sessions, HTTP API, stores | — | **owns** (`kernels.py`, `main.py`, `engine.py`) |
| Workflow files, projects, workspace | — | **owns** (`file_manager.py`, `.simple-steps-workflow`) |
| Showing values: images, figures, tables, dicts | — | **owns** (`cell_types.py`, `CellViewer`) |
| The UI, the agent, the console, examples | — | **owns** |

**Test of where something belongs:** if a different front end (a notebook, a
script, another app) would need it to get the same *results*, it belongs in
core. If it's about how this app shows, stores or edits them, it belongs here.

## Rules at the line

From `docs/context.md`, which has the details and commands:

- **`external/simple-steps-core/` is read-only here.** The app never edits it.
- **A gap in core is shimmed in one place**: `src/SIMPLE_STEPS/core_bridge.py`,
  tagged `SHIM(core §X)`, and recorded in
  [`core-proposals/008-core-changes.md`](../core-proposals/008-core-changes.md)
  with an ask. Live shims today: `SHIM(core §C17)` (`mod.table()` passes the
  grid to the tool's first parameter), `SHIM(core §C18)` (catalog descriptions
  from the docstring), `SHIM(core §G)` (no `step` tool type in core).
- **Claims about core are checked by running core**, never by reading its
  docs alone — doc-based claims have been wrong here.
- **The pin in `pyproject.toml` and the submodule commit must match**
  (`scripts/preflight.py` checks; drift breaks installs).
- **Key core-driven behaviour changes are confirmed by the owner** before they
  land, one small piece at a time, and recorded in the dev plan.

## How a change crosses the line

```
 app needs something core doesn't do
        │
        ├─ can wait?        → write an ask (core-proposals/, with a script that
        │                     reproduces it, run against core alone)
        └─ can't wait?      → shim it in core_bridge.py, SHIM(core §X), + the ask
                                     │
 core answers (owner changes core)   ▼
        │
 move the pin (pyproject + submodule) → preflight → backend tests → examples
        │                                (each example has a Python twin run in
        │                                 core directly; app and twin must agree)
        ▼
 owner confirms each user-visible change → delete the shim → record in the dev plan
```

The examples are the contract test of the split: every saved workflow is run
the way the UI runs it **and** as plain Python against core
(`example_check.py`), and the two must agree step for step.

## Where the line is blurry today

- **The app's older formula syntax** (`=op.map(…)`) still runs on the app's own
  engine (`formula_parser.py`, `OPERATION_REGISTRY`, the orchestrators in
  `engine.py`, the per-step path in `grid_runner.py`), outside core. Staged for
  removal (`docs/cleanup-map.md`); a workflow in core's syntax never touches it.
- **Raw values** — a `step` tool's dict or scalar — are kept by the app
  (`RAW_STORE`) rather than as a core Output.
- **Verb suggestions in the editor** (`infer_verb_for`) are the app's guess;
  at run time core decides (`mod.auto()`).
- **Stored output copies** (`DATA_STORE`) duplicate what the kernel's core
  Workflow already holds; [doc 11](11-data-flow-and-storage.md) removes them.
- **Saving outputs that aren't tables** depends on core asks C29/C30/C32.

## Open asks of core

Tracked in [`008-core-changes.md`](../core-proposals/008-core-changes.md):
C28 (`header[k]` silently ignores `k`), C29 (an image-array payload crashes the
session export), C30 (save per step, so one unsaveable payload doesn't lose the
rest), C31 (a `mod.table()` tool returning a list is stored as `None`), and —
proposed in doc 11 — C32 (a pluggable output store).
