# Specification: The environment explorer and the in-app docs

The sidebar's second panel (it was the Session Manager) becomes the
**Environment** explorer: everything a workflow in this app can use — its
tools and its resources — and, for any one of them, all that is known about
it. The **User Docs** panel shows the current usage docs
(`docs/usage_docs/`), in the installed app as well as in a checkout.

## 1. What the environment is

Served by the backend from core's own catalog (`grid.catalog`,
`grid.resource_entry`), so a tool reads the same here as in core and in the
step editor.

- **REQ-ENV-001:** `GET /api/environment` returns `tools`: every tool a step
  can name — the app's tools and core's built-ins (`identity`, `gather`,
  `count`, …), never the legacy verb or orchestrator operations. Each has its
  id, label, category, origin (core's word: `declared` / `builtin`), description, its
  parameters (name, Python type as written — `int`, `LLM`, `DataFrame` — or
  none when unannotated, required, default, choices, description) and its
  return type.
- **REQ-ENV-002:** a parameter whose type is a resource type the app declared
  (or a base of one: `llm: LLM` fits `FakeLLM`) is marked `resource`, with the
  resource types that fit it.
- **REQ-ENV-003:** `GET /api/environment` returns `resource_types` (each with
  description, settings, bound tools with their parameters and return type,
  and base types) and `resources`: the ready-made resources the deployment
  provides, with their type and settings (values read from the environment
  only as `env:NAME`).

## 2. The explorer

- **REQ-ENV-004:** the Environment panel lists tools by category (built-ins
  last) and resources (this workflow's, ready-made, and resource types), with
  counts, and one filter box that narrows all of them by name, category,
  type or description.
- **REQ-ENV-005:** clicking a tool shows its details: id, category, origin,
  description, every input with its type, required or default, and
  description (a resource input says which resource types fit), its output
  type, and a formula to start from.
- **REQ-ENV-006:** clicking a resource or resource type shows its type,
  description, settings (a resource's values; a type's types and defaults),
  base types, and its bound tools — each of which opens like any tool.

## 3. The docs

- **REQ-ENV-007:** the User Docs panel lists every page of
  `docs/usage_docs/` (its README first, as "Start here"), titled by each
  page's first heading, and is built into the frontend bundle, so the
  installed app needs no docs on disk. The docs are in two parts, and the
  panel shows them so: the **User guide** (`user/`) first and open, then the
  **Developer guide** (`developer/`), folded until asked for. A link to
  another page of the docs, relative to the page it's on, opens that page in
  the panel.
- **REQ-ENV-008:** a change to `docs/usage_docs/` — any page, in either
  guide — marks the shipped bundle stale, exactly as a change under
  `frontend/src` does (`preflight`).
