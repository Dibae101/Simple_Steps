# Data flow and storage

> As built on 2026-10-23, app on core `86170a3`: where data lives, and how it
> moves between the server and the browser — today, what's wrong with it, and
> the target (shaped like Jupyter Server / JupyterLab). Objects are defined in
> [the object model](10-object-model.md).

## Today

```
 BROWSER (React)                                   SERVER (FastAPI, one process)
 ───────────────                                   ─────────────────────────────
 workflow state                                    
   steps: formula, label,          POST /api/run   ┌─ kernel (one workflow) ──────────┐
   outputRefId, staleReason ──── formulas+ids ───► │  core Workflow                   │
   output_preview (≤50 rows)                        │  every step's Output (in RAM)    │
                                                    └──────────┬───────────────────────┘
                                                               │ copy the result frame
                                                               ▼
                                   ◄── ref + metrics ──  DATA_STORE[session][ref]  (RAM, never freed)
                                       + all step states   (+ parquet if result_store=parquet)
   waitForStableOutput  ── GET /api/data-meta/{ref} ──►    (polled until rows stop changing)
   grid (first 50 rows) ── GET /api/data/{ref}?limit=50 ►  → JSON Cell[] (value, display, preview thumb)
   inspector, whole col ── GET /api/data/{ref}?limit=5000►
   cell viewer          ── GET /api/cell/{ref}?row&col ─►  → full image / Plotly figure / table
   progress bar         ◄─ SSE /api/progress/{step} ────
   after an edit        ── POST /api/workflow/sync ────►  → step states + refs for missing outputs
   Save                 ── POST /api/projects/…/pipelines► workflow file (formulas only)

 kernel put away  ──►  .simple_steps_cache/<session>/kernels/<hash>.json  (all outputs as JSON text)
```

### Where data lives

| Data | Lives in | Lifetime |
|---|---|---|
| Formulas, resources, step meta | the workflow file, and the browser's copy | saved by the user |
| Every step's Output (results, cell states, versions) | the **kernel**: one core `Workflow` per (session, workflow), `MAX_LIVE = 1` per session | while active; put away to disk when another workflow opens, after `IDLE_SECONDS`, and at shutdown; restored without recomputing |
| A copy of each run's result table | `DATA_STORE[session][ref]` (raw values in `RAW_STORE`); also parquet under `.simple_steps_cache/<session>/` when `result_store=parquet` | **never freed** |
| A put-away kernel | `.simple_steps_cache/<session-token>/kernels/<sha(key)>.json` — core's `to_session_dict()`: steps and outputs as JSON | until overwritten. If core can't save an output (image arrays, Figures — core asks C29, C30), only the steps are saved, and they re-run |
| The first 50 rows of each step, as cells | the browser (`output_preview`) | until the next run or reload |

### Message by message

| When | Browser → server | Server → browser |
|---|---|---|
| Run a step | `POST /api/run` — the formula, and every step's `{id, name, formula, ref}` with `workflow_key` | `output_ref_id`, metrics (rows, columns, verb, failures, warnings), every step's state, refs of inputs it ran first |
| Wait for it | `GET /api/data-meta/{ref}`, polled until the row count stops changing | rows, columns |
| Show the grid | `GET /api/data/{ref}?offset=0&limit=50` | `Cell[]` |
| Open a column in the inspector | `GET /api/data/{ref}?limit=…` (to 5000) | `Cell[]` |
| Open a typed cell | `GET /api/cell/{ref}?row&column` | the full value (image, figure, table) |
| Progress while running | SSE `GET /api/progress/{step_id}` | progress events |
| After an edit; a workflow becomes active | `POST /api/workflow/sync` — every step | every step's state, refs for outputs the browser lacks |
| Save | `POST /api/projects/{p}/pipelines` | the saved file |

### What's wrong with it

1. **Outputs are stored twice**: in the kernel, and copied under a new ref on
   every run. The copies are never freed: memory grows with every run.
2. **The browser reads by ref**, an id that means something only to this
   process — lost on restart, and tied to neither the step nor its version.
3. **The grid doesn't use core's views.** `/api/data` sends plain cells, so the
   grid can't show core's per-cell states (failed, blocked, stale, staged) —
   what spec 014 §4 needs (`wf.preview`, `wf.cell`).
4. **The browser polls** (`data-meta` until stable; a timer after edits)
   instead of the server saying what changed.
5. **The disk layer is keyed by browser session**, kept where the server
   started rather than with the workflow, and stores tables as JSON text.

## Target: shaped like Jupyter Server

Jupyter Server has a **contents manager** (files), a **kernel manager**
(start, cull, restart), a **session manager** — which binds a *document path*
to a kernel, so any browser opening the notebook reaches the same kernel — and
checkpoints kept next to the file. Simple Steps maps onto it one to one; the
difference is in our favour: a Simple Steps kernel has no hidden state, so it
can be saved and restored exactly, and core knows which steps are out of date.

```
 BROWSER                                           SERVER
 ───────                                           ──────
 workflow doc (formulas)  ── PUT /api/contents/{path} ─►  contents manager → sales.simple-steps-workflow

 open workflow            ── POST /api/sessions {path} ─► session manager: path → kernel
                          ◄── kernel id ───────────────

 ┌ one WebSocket per open workflow ──────────────────┐   ┌─ kernel (per workflow path) ─────────┐
 │ → run(step) / sync(steps) / interrupt             │──►│  core Workflow — the ONLY copy       │
 │ ← status: busy/idle, progress                     │◄──│  emits: step ran / failed / stale,   │
 │ ← step(name, version, status, stale_reason, shape)│   │         with core's data version     │
 └───────────────────────────────────────────────────┘   └───────────────┬──────────────────────┘
                                                                          │ reads come from core:
 grid window   ── GET …/steps/{step}/preview?rows=0:50&v={version} ──►    wf.preview  (values + per-cell states)
 cell / inspector ─ GET …/steps/{step}/cell?row&col&v={version} ───►    wf.cell     (full value, inputs)
 whole column  ── GET …/steps/{step}/preview?cols=n&rows=0:5000&v= ─►    (paged)
                ◄── responses are immutable per version → cacheable (ETag = version)
                                                                          │
                                       kernel put away / restored ◄──────┘
                                       <project>/.simple-steps_cache/sales/
                                          manifest.json   (steps, versions, reads, states)
                                          outputs/<version>.parquet, <version>/…png …
```

### Principles

- **The kernel is the only copy.** No ref copies: reads come from core's
  Output. (Fixes 1.)
- **Data is addressed by (workflow path, step, version).** A version is a
  content hash, so a response for it never changes — the browser caches it and
  refetches only when the version moves. (Fixes 2.)
- **Reads go through core's views**: `wf.preview` for a grid window with cell
  states, `wf.cell` for one cell's full value and its inputs. (Fixes 3; this is
  phase 3's data source.)
- **The server pushes.** One socket per open workflow carries Jupyter-style
  messages: busy/idle, progress, "step X is now at version V", "step Y is
  stale because …". (Fixes 4.)
- **Disk is the kernel's put-away format only**, next to the workflow:

```
<workspace>/projects/<project>/
  sales.simple-steps-workflow            ← the recipe — what is committed
  .simple-steps_cache/
    .gitignore                           ← "*": the cache ignores itself
    sales/
      manifest.json                      ← core's light export; per step: version,
                                            reads, states, notes, which file holds it
      outputs/
        <version>.parquet                ← a table, named by its data version
        <version>/swatch-3.png           ← an image payload, as a file
        <version>/chart-0.plotly.json    ← a figure, in its own format
```

  Named by version, so an unchanged output is never rewritten; parquet for
  tables and real files for objects; the cache travels with the project, and
  deleting it only means re-running. Kernels are keyed by the workflow's path,
  not the browser. (Fixes 5.)

### What it needs from core

One ask (C32, replacing C29/C30): a **pluggable output store** for the session
export — hand each step's output (data, states, notes, version, reads) to the
caller to write, and accept a loader on `Workflow.from_dict(…, outputs=loader)`,
with a payload hook for objects (an image to PNG and back). Tables can start
with what core has today.

### Order

1. **Reads by (workflow, step, version)** from `wf.preview` / `wf.cell`; drop
   the ref copies for core steps. Fixes the memory leak; feeds phase 3.
2. **Kernels keyed by workflow path** (the session manager).
3. **A socket per workflow** for run, status and staleness; no more polling.
4. **The binary cache next to the workflow**: manifest + parquet (C32 for
   objects).
5. Later, if needed: **kernels in their own processes**, as Jupyter does —
   a stuck step can be stopped, two workflows can run at once, memory is
   bounded per workflow.
