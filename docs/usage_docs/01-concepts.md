# 01 — Concepts

Simple Steps is a platform that brings Python developers and users familiar
with spreadsheet software into one framework. Developers define **tools** and
**resources** as standard Python functions and classes; users orchestrate and
run them as linear **workflows** made of **steps**. A step is a decorated
tool applied to an input, together with its output — think of it as a small
sheet in spreadsheet software. The platform lets developers put their code in
the hands of people who will never read it.


Seven words cover it.

## Tool

A Python function the user can run as a step.

```python
from SIMPLE_STEPS import simple_step_tool

@simple_step_tool(category="Shop")
def with_tax(price: float, rate: float = 0.08) -> float:
    """The price including tax.

    Args:
        price: the price before tax.
        rate: the tax rate, as a fraction.
    """
    return round(price * (1 + rate), 2)
```

The decorator doesn't change the function — `with_tax(10.0)` still returns
`10.8`. It registers it, and its signature and docstring become what the UI
shows: the name, a field per parameter, the help text from `Args:`.

## Step

One named stage of a workflow: a **formula** — the tool it applies, and to
what — and the output it produces:

```
taxed  =  with_tax[mod.map(name="total")](wf["items"], rate=0.1)
```

A step reads (at most) one earlier step, here `wf["items"]`, and produces a
table.

## Workflow

An ordered list of steps, saved as a `.simple-steps-workflow` file under
`projects/<project>/`. Running a workflow runs its steps in a linear sequence.



## tool modifiers
The part in square brackets that modifies the function being executed, think of them as runtime dectorations of the tool, they help faciliate the orchestration and execution of the tool


## reshaping modifiers
The part in square brackets says **what shape the output has**:

| verb | rows in → rows out | the tool is… |
|---|---|---|
| `mod.source()` | nothing → a table | a function that builds a table |
| `mod.map()` | n → n, one new column | called once per row |
| `mod.filter()` | n → fewer | a predicate (`-> bool`) |
| `mod.expand()` | n → more | returns a list per row |
| `mod.collapse()` | n → 1 (or 1 per group) | a reducer `(acc, x)` |
| `mod.group()` | n → n, plus a key column | a key function |
| `mod.table()` | table → table | given the whole `DataFrame` |

Some verbs need no tool at all — `select`, `drop`, `rename`, `sort`,
`slice`, `distinct` — and use the built-in `identity`. Leave the brackets
off and Simple Steps picks the verb from the tool's signature.

## Column-by-name

A per-row tool's parameters are filled **from columns of the same name**.
`with_tax(price, rate)` over a table with a `price` column gets each row's
price; `rate` has no column, so it comes from the formula (`rate=0.1`) or
the default.

## Resource

Something tools *use* that isn't data — a database connection, a language
model, an API client. Declared with `simple_step_resource`, configured once
per workflow, and passed to a step as `res["name"]`.

## App

The bundle of tools and resources you hand to users:
and serve as a simple steps application
```python
from SIMPLE_STEPS import App
import my_tools

app = App(tools=[my_tools], title="My shop")
```

`simple-steps run app.py` serves it in the browser. The folder holding
`app.py` is the **workspace**: its `projects/` folder holds the workflows.

---

Next: [build one](02-build-an-app.md).
