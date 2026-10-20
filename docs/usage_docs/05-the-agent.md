# 05 — The agent

The agent is a chat pane that **writes steps for you**. You describe what you
want; it proposes steps in the formula syntax; you review the proposal and
apply it. It never runs a step and never changes the workflow on its own.

The worked example, with requests to try and a test harness, is
[`examples/agent_demo/`](../../src/SIMPLE_STEPS/examples/agent_demo/README.md).

## Turn it on

The agent uses a local model served by [Ollama](https://ollama.com):

```bash
ollama pull llama3.2:3b                      # the default model, about 2 GB
simple-steps run examples/agent_demo/app.py
```

An app turns it on, picks the model, or turns it off with `agent=`:

```python
from SIMPLE_STEPS import App
from SIMPLE_STEPS.agent.model import Agent

app = App(tools=[my_tools], agent=Agent(model="qwen2.5:7b"))  # this model
app = App(tools=[my_tools])                                   # a local Ollama, if one is running
app = App(tools=[my_tools], agent=False)                      # off
```

`OLLAMA_MODEL` and `OLLAMA_HOST` set the default model and host. Without a
model the app runs as usual; the chat pane says the agent is off, and why.

## Use it

1. Open a workflow and **Run All**, so the agent can see what each step holds.
2. Open the chat pane with the tab on the right edge (**Show chat**).
3. Ask for one thing at a time, and name the step you want:
   *"Add a step called totals with each order's total: price times quantity."*
4. Read the proposal: each change is an **add**, **change** or **remove**,
   with its formula and any problem the checks found.
5. **Apply** it, then run the new steps. Not right? Say what's wrong —
   *"use a threshold of 50"* — and it proposes a change.

You can also ask questions — *"which tool keeps the large orders?"* — and
get an answer with no changes.

## What it checks before you see a proposal

Every proposed formula must compile, read only earlier steps (`wf[…]`), use
only resources the workflow has (`res[…]`), and use only real tools. A
proposal that fails goes back to the model with the problem, a couple of
times; anything still wrong is shown with its problem rather than hidden.

The checks guarantee a proposal is **well-formed**, not that it does what you
meant. Run it, and look at the output.

## Make your tools easy for it

The agent sees each tool's **name, signature and first docstring line** — not
its code. So:

- name tools for what they do: `line_total`, not `calc`;
- name parameters after the columns they read: `price`, `quantity`;
- make the first docstring line a sentence a user might say;
- use return types: `-> bool` says filter, `(acc, x)` says reducer.

## Test it against your model

```bash
python examples/agent_demo/ask.py              # five requests, then checks what it built
python examples/agent_demo/ask.py "keep only tea orders"
```

Small models vary; `ask.py` tells you how yours does (`5/5 tasks done right`),
and saves what it built as a workflow you can open.

## Stable, and not yet

**Expect to stay:** the agent proposes and you apply; proposals are checked
before you see them; it reads your tools' names, signatures and docstrings.

**Expect to change:** Ollama being the only provider (the settings panel
lists others, but only Ollama is used today); the chat pane's layout; the
default model.
