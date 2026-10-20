# 03 — Use an application

For someone running an app built by someone else. The UI is still changing,
so this describes what you do rather than exactly where each button is.

## Start it

```bash
simple-steps run app.py          # the app file you were given
```

A browser tab opens. If port 8000 is busy, the next free port is used and
printed. `--no-browser` and `--port 9000` do what they say.

No app file? `simple-steps --load-examples` copies the examples to
`./examples`; `simple-steps run examples/basic/app.py` is a good first one.

## Open a workflow

The **file explorer** lists projects and their workflows. Open one, then
press **Run All**. Each step becomes a column of results; click a step to
see its table.

## Build a workflow

1. **Start with a source.** A workflow begins with a step that reads
   nothing: a built-in like `to_rows` or `load_csv`, or one of the app's
   source tools.
2. **Add a step.** Pick a tool from the **palette** (or type in the formula
   bar — it autocompletes tool names).
3. **Point it at an earlier step** with `wf["that_step"]`.
4. **Choose the verb** — map, filter, collapse… — which decides the
   shape of the output (see [Concepts](01-concepts.md#verb-shape)).
5. **Fill in the arguments** in the form, or in the formula directly.
6. **Run** the step, or **Run All**.

The **formula bar is the truth.** The form fields and dropdowns only edit
the formula; whatever the formula says is what runs and what gets saved.

## A first workflow, by hand

With any app, the built-in tools are enough to try the ideas:

```
nums      =[3, 1, 2]
rows      =identity[mod.expand()](wf["nums"])
sorted    =identity[mod.sort(by="value")](wf["rows"])
how_many  =count[mod.collapse()](wf["rows"])
```

`nums` is one cell holding a list; `expand` turns it into three rows in a
`value` column; `sort` orders them; `collapse` with `count` gives `3`.

## When a step is refused

Many mistakes are caught **before anything runs**, with a message saying
what to write instead:

| you wrote | you're told |
|---|---|
| `scale[mod.map()](readings)` | readings is not defined. To use the step "readings", write wf["readings"] |
| `scale[mod.map()]("readings")` | "readings" is a string. Did you mean wf["readings"]? |
| `scale[mod.mapp()](wf["readings"])` | unknown modifier mod.mapp |
| `identity[mod.select(columns=["score"])](wf["readings"])` | select names 'score', which the input does not have (it has city, n) |

If some **rows fail** (the tool raised on them), the other rows still have
results, and **Run All** stops at that step. Add `mod.try_except()` —
optionally `mod.try_except(default=0)` — to let failures through.

The full list, with fixes:
[`examples/bad_examples/`](../../src/SIMPLE_STEPS/examples/bad_examples/README.md).

## Save and share

Workflows are saved as `.simple-steps-workflow` files under
`projects/<project>/` in the app's workspace. Send the file to someone with
the same app and they can open and run it. Resources' *settings* are saved
with it; secrets are not.

---

Next: [the formula syntax](04-formula-syntax.md).
