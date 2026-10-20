# Specification: The shipped examples

The examples in `src/SIMPLE_STEPS/examples/` ship in the wheel
(`simple-steps --load-examples`) and are the first thing a new user runs.
They prove, by running, that a saved workflow does what the same workflow
written in Python does.

## 1. Structure

- **REQ-EX-001:** the examples are a main example and sub-examples, one per
  theme: `basic/` (core verbs and data manipulation), `dummy_llm/`
  (resources, with an optional real model) and `plotly_charts/` (Plotly
  figures and other rich cells). Each sub-example has:
  - its tools in a module whose name is unique across the examples;
  - an `app.py` building an `App` of those tools, whose workspace is the
    sub-example's `workspace/`;
  - saved workflows in `workspace/projects/<name>/`;
  - a Python twin of each saved workflow (except one using a real model): one
    line per saved step, whose right-hand side is the step's formula;
  - a `runme.py`.
- **REQ-EX-002:** the main example's `app.py` offers every sub-example's
  tools and resources, and its workspace holds a workflow using tools from
  each sub-example.

## 2. Checking

- **REQ-EX-003:** a sub-example's `runme.py` runs each of its saved
  workflows step by step the way the UI's Run does (the engine `/api/run`
  calls), runs its Python twin in simple-steps-core, and fails unless every
  step's output matches — cell for cell, with images, tables and Plotly
  figures compared by content — and every explicit expectation it states
  holds. A workflow that needs something absent (a local model) is skipped
  with the reason, not failed. It exits non-zero on any failure.
- **REQ-EX-004:** the main example's `runme.py` runs every sub-example's
  `runme.py`, then checks the main workflow the same way, and exits non-zero
  if any of them failed. `--main-only` checks just the main workflow.
- **REQ-EX-005:** the checks run in the test suite, and the full install test
  runs the main `runme.py` from the copy `--load-examples` makes.
