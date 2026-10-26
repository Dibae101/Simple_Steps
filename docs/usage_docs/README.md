# Simple Steps docs

Simple Steps lets you build data workflows out of **steps**, the way you'd
build a spreadsheet out of cells — using tools someone wrote in Python,
without reading their code. These docs come in two parts. They're also in
the app: open the **User Docs** panel from the sidebar.

## Using Simple Steps — the User guide

For anyone building and running workflows in the app.

| page | read it when |
|---|---|
| [01 — Concepts](user/01-concepts.md) | first: the handful of ideas everything else is built from |
| [02 — Use the app](user/02-use-the-app.md) | you've been given an app: starting it, finding your way around, saving |
| [03 — Define a step](user/03-define-a-step.md) | you're adding or editing a step: the formula bar, the Formula panel, running, settings |
| [04 — Expressions](user/04-expressions.md) | you're writing a step's formula and want the exact syntax |
| [05 — The agent](user/05-the-agent.md) | you want the chat pane to write steps for you |

## Building applications — the Developer guide

For Python developers turning their functions into an app for others.
Start at the [Developer guide](developer/README.md):

| page | read it when |
|---|---|
| [01 — Build an application](developer/01-build-an-app.md) | you have Python functions and want them in the UI |
| [02 — Set up the agent](developer/02-the-agent.md) | you want the chat pane on, with your model, and your tools easy for it |
| [03 — Prefab views in cells](developer/03-prefab-views.md) | a tool should return a small interface (cards, numbers, a chart) that opens from its cell |

The shipped examples are the fuller reference, and they check themselves:
[`src/SIMPLE_STEPS/examples/README.md`](../../src/SIMPLE_STEPS/examples/README.md).
Copy them out with `simple-steps --load-examples`.
