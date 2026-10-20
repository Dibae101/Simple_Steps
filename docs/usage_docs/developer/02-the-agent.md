# 02 — Set up the agent

The agent is a chat pane that writes steps for your users: they describe what
they want, it proposes checked formulas, they apply them. How they use it is
in the User guide, [05 — The agent](../user/05-the-agent.md). This page is
the app side: turning it on, choosing the model, and writing tools it can use
well.

The worked example, with requests to try and a test harness, is
[`examples/agent_demo/`](../../../src/SIMPLE_STEPS/examples/agent_demo/README.md).

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

**Expect to stay:** proposals are checked before the user sees them; the
agent reads your tools' names, signatures and docstrings.

**Expect to change:** Ollama being the only provider (the settings panel
lists others, but only Ollama is used today); the default model.
