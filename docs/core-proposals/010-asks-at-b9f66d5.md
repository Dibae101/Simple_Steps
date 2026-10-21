# 010 — The app's asks of core at `b9f66d5`

> **For simple-steps-core.** From the Simple Steps app, 2026-10-21, after
> moving the app to core `b9f66d5` (core 009). Every result below was
> produced by running core alone at `b9f66d5` with the script at the end;
> the app's tracking table is in its `docs/core-proposals/008-core-changes.md`
> (asks C21–C27).

## Summary

| # | Ask | Kind | Priority |
|---|---|---|---|
| **C22** | `zip_` refuses grids that share a column name, instead of silently keeping the first | wrong result, silently | **1** |
| **C23** | `collapse(by=…)` naming a column the input lacks is refused at declaration | crash at run | 1 |
| **C27** | `wf.cell(...)["inputs"]` lists every input cell: argument references too, and the columns read | incomplete | 2 |
| **C24** | `wf.cell(...)["inputs"][].state` uses cell states (`known`), not step statuses | inconsistent | 2 |
| **C25** | Per-cell staleness (009 step 7) | feature | 2 |
| **C21** | Make "would this output stop a run" public (still open) | boundary | 3 |
| **C26** | `009-status.md` and `ui-context.md` still call `wf.preview` / `wf.cell` uncommitted | docs | 3 |

---

## C22. `zip_` silently drops a column both grids have

**Run:** `zip_(r, d)` where `r` has `city, n` and `d = double_n[mod.map(name="n")](r)`
(its one column is also `n`).

**Got:** declared with no problems or warnings; ran `completed`, columns
`['city', 'n']`, `n = [1, 0, 2]`. `d`'s `n` (`[2, 0, 4]`) is gone, without a
message.

**Why it matters:** 009 decision 2 is "never drop silently", and with
results-only steps zipping a result beside its input is now the normal way
to read inputs, so a result named like an input column is an easy mistake.

**Ask:** refuse at declaration, naming the shared column(s) and both steps,
and saying how to fix it (rename one side: `mod.map(name=…)` or `mod.rename`).
If keeping both is wanted later, a `suffixes=` setting would be explicit.

**Done when:** the zip above has a problem like *"zip_: 'n' is in both 'r'
and 'd'; rename one (mod.map(name=…) or mod.rename)"*, and `run` records
the step invalid rather than completing.

## C23. `collapse(by=…)` on a missing column crashes at run

**Run:** `s = scale[mod.map()](r)` (only `value`), then
`add_total[mod.collapse(by="city", initial=0)](s)`.

**Got:** declared with no problems; `wf.run` raised a bare pandas
`KeyError: 'city'` from `collapse_`.

**Ask:** check `by=` against the input's known (or planned) columns at
declaration, like `select` and `rename` already do (*"collapse groups by
'city', which 's' does not have (it has value)"*). When the input's columns
aren't known yet, check at run and fail the step with that message instead
of raising.

## C27. `wf.cell(...)["inputs"]` is incomplete

**Run:** `s = scale[mod.map()](r, weight=w[0][cols["w"]])`, then
`wf.cell("s", 1, "value")["inputs"]`.

**Got:** `[{"step": "r", "id": 1, "state": "completed"}]`.

**Missing:** the argument cell (`w` row 0, column `w`) and the column read
from the input (`n`).

**Why it matters:** the app must be able to trace any output cell to the
exact input cells that made it (an owner requirement for accepting
results-only steps). It can do so today by combining row ids with the saved
formula, but core knows the binding and is the right place for it.

**Ask:** each input names `step`, `id` (or row), `columns`, and the
`argument` it was bound to:

```json
[{"step": "r", "id": 1, "columns": ["n"], "argument": "n", "state": "known"},
 {"step": "w", "id": 0, "columns": ["w"], "argument": "weight", "state": "known"}]
```

## C24. Cell inputs use step statuses for `state`

Same call as C27: `"state": "completed"` is a step status. 009 §4 shows
cell states (`"state": "known"`). Use the cell's state (`known`, `failed`,
`blocked`, …) so the UI reads one vocabulary.

## C25. Per-cell staleness (009 step 7)

The app's output-state spec marks out-of-date data per cell. Until 009
step 7 lands it falls back to per step, so editing one input row marks the
whole reading column out of date. Asking for this to be prioritised among
009's remaining steps.

## C21. Whether an output stops a run (still open)

The app counts rows that would stop `run_all` with the same rule as the
private `grid._uncaught_failure` (state `failed`, no `cause`, not
`caught`), read from `row_states` and `notes`. Checked at `b9f66d5`: a
breaker-stopped row is `failed` with no cause, so it counts; `try_except`
written after the verb sets `caught: True`. Ask unchanged: make it public
(`Output.uncaught`, or a count).

## C26. Docs behind the code

`docs/core-proposals/009-status.md` and `docs/ui-context.md` say
`wf.preview`, `wf.cell` and the data/states/meta output are uncommitted;
they are in `b9f66d5`.

---

## Reproduction (core only)

```python
import pandas as pd
from simple_steps_core import grid
from simple_steps_core.grid import mod, tool, zip_, cols


@tool
def double_n(n: int) -> int:
    return n * 2


@tool
def scale(n: int, weight: float = 1) -> float:
    return n * weight


@tool
def add_total(acc, value: float) -> float:
    return (acc or 0) + value


# C22
wf = grid.Workflow()
wf["r"] = pd.DataFrame({"city": ["SF", "NYC", "LA"], "n": [1, 0, 2]})
wf["d"] = double_n[mod.map(name="n")](wf["r"])
wf["z"] = zip_(wf["r"], wf["d"])
print(wf.step("z").problems, wf.step("z").warnings)          # () ()
wf.run("d"); wf.run("z")
print(list(wf.step("z").output.data.columns), list(wf.step("z").output.data["n"]))
# ['city', 'n'] [1, 0, 2]   — d's n [2, 0, 4] dropped

# C24 / C27
wf = grid.Workflow()
wf["r"] = pd.DataFrame({"city": ["SF", "NYC", "LA"], "n": [1, 2, 3]})
wf["w"] = pd.DataFrame({"w": [1.5]})
wf["s"] = scale[mod.map()](wf["r"], weight=wf["w"][0][cols["w"]])
wf.run("s")
print(wf.cell("s", 1, "value")["inputs"])
# [{'step': 'r', 'id': 1, 'state': 'completed'}]

# C23 (last: it raises)
wf = grid.Workflow()
wf["r"] = pd.DataFrame({"city": ["SF", "NYC"], "n": [1, 2]})
wf["s"] = scale[mod.map()](wf["r"])
wf["c"] = add_total[mod.collapse(by="city", initial=0)](wf["s"])
print(wf.step("c").problems)                                 # ()
wf.run("s"); wf.run("c")                                     # KeyError: 'city'
```
