# Using Simple Steps

Start here if you want to **build** a Simple Steps application or **use** one.
These pages are deliberately basic: they cover the ideas that stay put, and
point at the examples for everything else.

| page | read it when |
|---|---|
| [01 — Concepts](01-concepts.md) | first: the handful of ideas everything else is built from |
| [02 — Build an application](02-build-an-app.md) | you have Python functions and want them in the UI |
| [03 — Use an application](03-use-an-app.md) | someone gave you an app and you want to build workflows in it |
| [04 — Formula syntax](04-formula-syntax.md) | you're writing steps in the formula bar, or reading saved workflows |

The shipped examples are the fuller reference, and they check themselves:
[`src/SIMPLE_STEPS/examples/README.md`](../../src/SIMPLE_STEPS/examples/README.md).
Copy them out with `simple-steps --load-examples`.

## What is stable, and what isn't yet

Simple Steps is early. Some ideas are settled and you can build on them;
some details are still moving. As a rough estimate:

**Expect these to stay**

- **Tools are plain Python functions** with a decorator, `@simple_step_tool`.
  A tool's signature and docstring *are* its contract: parameter names,
  type hints, defaults and the `Args:` section are what the UI shows.
- **A workflow is a list of named steps; each step is one formula.** The
  formula is the single source of truth — the UI's forms only edit it.
- **The formula is simple-steps-core's operation syntax, and it is valid
  Python:** `tool[mod.verb(...)](wf["step"], arg=...)`. The same line runs in
  the UI and in a Python script.
- **`wf["name"]` is the only way to refer to another step.**
- **The shape verbs** — `map`, `filter`, `collapse`, `expand`, `group`,
  `select`, `sort`, `table`, `source`, `sweep`, … — and the idea that a
  verb decides the *shape* of a step's output while the tool decides the
  *values*.
- **Per-row tools read columns by name.** A parameter called `price` reads
  the input's `price` column.
- **Resources** (databases, models, clients) are separate from data: declared
  with `simple_step_resource`, referred to as `res["name"]`.
- **An application is an `App(...)`** in an `app.py`, run with
  `simple-steps run app.py`.

**Expect these to change**

- The UI's layout, panels and button names.
- The on-disk workflow format (`format_version` in `.simple-steps-workflow`
  files) — save and load through the app rather than hand-writing it.
- Decorator keyword arguments beyond `category` (for example
  `operation_type=` and `id=`), and how fully type hints such as `Literal`
  are turned into UI controls.
- The built-in tool list, and the exact wording of error messages.
- What `mod.timeout(...)` actually enforces (today it doesn't stop a slow
  row).
- Legacy CLI flags (`--ops`, `--packs`) and the deprecated `@simple_step`
  alias — don't start new work on them.
