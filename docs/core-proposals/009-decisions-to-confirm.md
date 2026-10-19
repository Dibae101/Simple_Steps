# 009 — Core's decisions the app has to confirm

> **For the app owner, and core's reply.** Status: **open**. Core
> (`9a86a0d`, its `008-status.md`) made eight behaviour choices while closing
> 008 and asked the app to confirm them. Every "Core does" block below was
> produced by **running** core at `9a86a0d` on 2026-10-19, not copied from
> core's reply. Two of the runs disagree with that reply (decisions 5 and 7);
> one found a bug, filed as [008 C20](008-core-changes.md#c20-a-selection-as-a-tools-input-is-silently-ignored-in-json).
>
> To decide: tick **Confirm** or **Change** on each, and fill in the note.
> Then send core the result and update 008's status section.

## At a glance

| # | Decision | Affects the app today? | Recommendation |
|---|---|---|---|
| 1 | An uncaught failure stops the whole run | No (the app never calls `run_all`) | **Confirm**, and make the app's Run All match |
| 2 | An explicit argument beats a same-named column, with a warning | Yes: the warning is lost | **Confirm**, and show core's warnings |
| 3 | Only an explicit `name=` clash is refused; the default `value` clash warns | Yes: the warning is lost | **Confirm**, and show core's warnings |
| 4 | A step that can't run is `invalid`, not `failed` | No | **Confirm** |
| 5 | Whole-number float columns with gaps become `Int64` | Yes: ints display as ints | **Confirm**, but ask core about `pd.NA` |
| 6 | An accumulator is recognised by its parameter name | Yes: some tools change verb after a run | **Change**: the fix only covers 4 names |
| 7 | A selection can't be a tool's input | Yes: core's JSON path ignores it silently | **Confirm**; fix C20 first; defer row-only selections |
| 8 | `resource_catalog()` stays separate from `catalog()` | No | **Confirm** |

Rows 2, 3 and 6 need app work whatever is decided, listed under
[App follow-ups](#app-follow-ups).

---

## 1. An uncaught failure stops the whole run

**Replaces** 008 C10's "run_all runs everything else".

**Core does:** `run_all` raises at the first step with a failed row, and
names the steps it didn't run. Running one step records the failure without
raising. `mod.try_except` opts a step out.

```
wf["a"] = boom[mod.map()](wf["r"])        # boom raises on n == 2
wf["b"] = plus1[mod.map()](wf["a"])
wf.run_all()
→ StepFailed: step 'a' failed at a[1]: ValueError: boom. The run stopped.
  Not run: b. Add mod.try_except(…) to the step to let this failure through.

wf.run("a")                                → status failed; rows completed, failed, completed
boom[mod.try_except(default=0), mod.map()] → [1, 0, 3]; ledger: "caught ValueError: boom; used the default"
```

**In the app today:** no effect. The app runs one step at a time
(`wf.run`) and never calls `run_all`. The UI's **Run All**
(`useWorkflow.ts`) stops only when a step returns no output. A step with
failed *rows* still returns output, so Run All carries on past it. The app
therefore follows the old C10 rule, not this one.

**Recommendation: Confirm.** A failed row that flows on unnoticed is the
"wrong result that looks right" 008 exists to prevent, and `try_except`
makes letting it through a written choice. If confirmed, the app's Run All
should stop on a step whose metrics report failed rows (unless that step has
`try_except`), so the UI and core agree.

- [ ] Confirm  - [ ] Change  — note:

## 2. An explicit argument beats a same-named column, with a warning

**008 N2 asked for** a refusal. Core chose a warning.

**Core does:** the explicit value is used for every row, and the step carries
a warning, not a problem.

```
wf["g"] = greet[mod.map()](wf["r"], city="Paris")     # r has a 'city' column
problems: ()
warnings: ("city='Paris' overrides the 'city' column of 'r' for every row;
           drop the argument to use the column",)
result:   ['hi Paris', 'hi Paris', 'hi Paris']
```

**In the app today:** the step runs as above, but **the warning never reaches
the user**. `grid_runner` reads `step.problems` and ignores `step.warnings`.

**Recommendation: Confirm.** Before 9a86a0d the column won *silently*;
an explicit argument winning is what the formula says. A warning is enough
only if someone sees it, so the app must show it (follow-up A).

- [ ] Confirm  - [ ] Change  — note:

## 3. Only an explicit `name=` clash is refused

**008 C13 asked** that an output never silently replace an input column.
Core narrowed that.

**Core does:**

```
inc[mod.map(name="n")](wf["r"])       # r has 'n'
→ problem: "map writes 'n', which r already has; choose another name
            (name=…), or say replace=True"

plus1[mod.map()](wf["v"])             # v has 'value', the default payload
→ no problem; warning: "map writes 'value' over the 'value' column 'v'
  already has; name the output (name=…) to keep both, or say replace=True
  to silence this"
→ result columns: ['value']           # the input's 'value' is gone
```

**In the app today:** the explicit clash is refused with core's message. The
default clash replaces the column, and **its warning is lost** (as in 2).
Chaining two default `map` steps is common, so this one will happen often.

**Recommendation: Confirm.** Refusing the default clash would break every
`map` of a `map`. But the replaced column must be visible (follow-up A).

- [ ] Confirm  - [ ] Change  — note:

## 4. A step that can't run is `invalid`, not `failed`

**008 C10's text** called a step reading a bad reference `failed`.

**Core does:** keeps two states. `invalid` means it can't run (found at
declaration); `failed` means it ran and cells failed.

```
inc[mod.map()](wf["nope"])
→ status invalid; problems: ("input 'nope', which is not an earlier step",)
```

**In the app today:** an invalid step is refused before it runs, with core's
problem text as the error. Nothing depends on the word `failed`.

**Recommendation: Confirm.** The two need different fixes (edit the formula
vs. look at the data), so they should stay separate.

- [ ] Confirm  - [ ] Change  — note:

## 5. Whole-number float columns with gaps become `Int64`

**Core does:** pandas' `convert_dtypes` rule. A float column whose values
are all whole numbers becomes a nullable int. Others stay float.

```
pd.DataFrame({"x": [1.0, None, 3.0], "y": [1.5, None, 2.0]})
→ dtypes {'x': 'Int64', 'y': 'float64'}
→ the missing cell in x is <NA>  (is None: False)
```

**In the app today:** visible as a fix. Pivoted counts show as `10`, not
`10.0`, and the grid shows the gap as empty (the app serialises `<NA>` as
`null`).

**Disagrees with core's reply:** C14 says "missing is `None`, never `NaN`".
In an `Int64` column the missing value is `pd.NA`, so a tool doing
`if x is None` gets it wrong. Core's own type check treats it as missing, so
this only bites tool code.

**Recommendation: Confirm**, and ask core to either hand tools `None` for
`pd.NA`, or to state in C14 that missing is `None` *or* `pd.NA`.

- [ ] Confirm  - [ ] Change  — note:

## 6. An accumulator is recognised by its parameter name

**008 K2 asked** that verb inference not depend on run state: the same tool
infers the same verb before and after its input runs.

**Core does:** recognises four names (`acc`, `accumulator`, `memo`, `carry`)
before a run. Any other name is still decided from the input's columns, so it
changes once the input has run.

```
f_acc(acc, n)       before the input runs → collapse   after → collapse
f_total(total, n)   before the input runs → map        after → collapse
```

**In the app today:** the step editor asks for the verb as you type
(`/api/infer_verb`). For a reducer whose accumulator isn't one of the four
names, the editor suggests `map` until the input runs, then `collapse`. A
step saved with `mod.auto()` before the first run can change shape on the
next run.

**Recommendation: Change.** K2 is only half fixed. Ask core to infer from
the signature alone, the same way in both states, and use column data only
to *warn* when the answer looks wrong. Failing that, document the four
names as the only accumulators, and treat any other first parameter as a
column.

- [ ] Confirm  - [ ] Change  — note:

## 7. A selection can't be a tool's input

**Core does:** refuses it in Python, and asks whether to allow a *row-only*
selection (`scale[mod.map()](wf["p"][1:5])`), since rows keep their ids.

```
inc[mod.map()](wf["r"][0:2])
→ TypeError: a selection can't be a tool's input: make it its own step
  (wf["part"] = wf["p"][…]) and pass wf["part"]
```

**Disagrees with core's reply. The JSON form isn't refused:**

```
Operation.from_dict({"tool_id": "inc",
    "input": {"$ref": "r", "rows": {"start": 0, "stop": 2}}, …})
→ problems: ()            # accepted, and saved with the selection
→ result: 3 rows, not 2   # the selection is silently ignored
```

The app builds steps from JSON, so this is the path it uses. Filed as 008
**C20** (priority 1: a wrong result that looks right).

**Recommendation: Confirm the refusal; ask core to fix C20 first.** On the
open question: **defer** row-only selections. A separate select step costs
one line, shows its rows in the grid, and keeps "a step reads a step" true.
Revisit if users ask for it.

- [ ] Confirm  - [ ] Change  — row-only selections: - [ ] defer  - [ ] allow  — note:

## 8. `resource_catalog()` stays separate from `catalog()`

**From core 007.** Tools and resource types are listed by two functions.

**Core does:** `catalog()` lists tools only; `resource_catalog()` lists
resource types and their bound tools.

**In the app today:** no effect. The app serves its own `/api/resources` and
doesn't merge the two.

**Recommendation: Confirm.** They describe different things (a call vs. an
object you configure), and the UI shows them in different places.

- [ ] Confirm  - [ ] Change  — note:

---

## App follow-ups

All three are **done**, specified in
[`spec/009-run-feedback.md`](../spec/009-run-feedback.md) (REQ-RUN-001…005)
and tested (TEST-RUN-01…05). The "In the app today" lines for decisions 1–3
above describe the app *before* them.

- **A. Show core's step warnings** (for 2 and 3) — done. `/api/run` metrics
  carry `warnings`; the log gets a `warn` entry and the step's summary panel
  lists them.
- **B. Run All stops on uncaught failed rows** (for 1) — done, **ahead of
  the decision**. Metrics carry `uncaught_failed` (core's rule, shimmed as
  008 C21); Run All stops after a step where it is above zero and logs how to
  let it through. If decision 1 is changed, remove the stop in
  `useWorkflow.ts` (`runPipeline`); the metric can stay.
- **C. Re-ask the verb after the input runs** (for 6) — already the case:
  the editor's request is keyed on the input's output reference, which is new
  on every run. TEST-RUN-05 now holds it there.
