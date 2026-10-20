"""
app.py — the agent example as a Simple Steps application.

    simple-steps run examples/agent_demo/app.py
    python examples/agent_demo/app.py

Open the chat pane (the tab on the right edge), open the ``start`` workflow,
and ask the agent for steps — README.md lists requests to try. The agent is a
local Ollama model; without one the app still runs, and the chat pane says
why the agent is off.

Which model: ``OLLAMA_MODEL`` if set, else ``llama3.2:3b``; ``OLLAMA_HOST``
if set, else ``http://localhost:11434``.
"""

from pathlib import Path

from SIMPLE_STEPS import App
from SIMPLE_STEPS.agent.model import Agent

import order_tools

app = App(
    tools=[order_tools],
    workspace=str(Path(__file__).resolve().parent / "workspace"),
    title="Agent: build a workflow by asking",
    # Agent() reads OLLAMA_MODEL and OLLAMA_HOST. A bigger model follows the
    # syntax more reliably: Agent(model="qwen2.5:7b").
    agent=Agent(),
)

if __name__ == "__main__":
    app.serve()
