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

## The sidebar

The icons down the left edge open four panels:

| panel | what it's for |
|---|---|
| **Explorer** | the workspace's files: projects and their workflows |
| **Environment** | every tool and resource this app gives you — click one for its details |
| **User Docs** | these pages |
| **Settings** (bottom) | where results are kept, and eval mode |

## Open a workflow

The **Explorer** lists projects and their workflows. Open one, then
press **Run All**. Each step becomes a column of results; click a step to
see its table.

## See what you can use

The **Environment** panel lists everything a step can use:

- **Tools**, grouped by category, with core's built-ins (`identity`,
  `count`, `gather`, …) at the end.
- **Resources**: the ones in this workflow, the ready-made ones the app
  provides, and the resource *types* you can create more of.

Click a **tool** to see its description, every input with its type and
default (or *required*), what it returns, and a formula to start from with
a **Copy** button. An input that takes a resource lists the resource types
that fit it. Click a **resource** or a type to see its settings and its own
tools, which open the same way. The filter box at the top searches all of it.

## Build a workflow

1. **Start with a source.** A workflow begins with a step that reads
   nothing: a built-in like `to_rows` or `load_csv`, or one of the app's
   source tools.
2. **Add a step.** Pick a tool in the step's **Formula** panel (or type in
   the formula bar — it autocompletes tool names). Not sure which? Look it
   up in the **Environment** panel.
3. **Point it at an earlier step** with `wf["that_step"]`.
4. **Choose the verb** — map, filter, collapse… — which decides the
   shape of the output (see [Concepts](01-concepts.md#reshaping-modifiers)).
   A step has one verb; choosing another replaces it. Choosing `select`,
   `sort` or another verb that needs no tool switches the tool to
   `identity`.
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
| `scale[mod.map(), mod.filter()](wf["readings"])` | 2 shape verbs in one step (map, filter); at most one is allowed. Split them into separate steps… |
| `scale[mod.sort(by="n")](wf["readings"])` | sort applies no tool, so it runs on identity: identity[mod.sort(by='n')](wf["…"]). To compute with scale, use map… |

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
