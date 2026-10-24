# System Design Documentation

Developer documentation describing the internal architecture and design of Simple Steps.

These documents are intended for contributors, maintainers, and anyone building on top of the platform. They explain *how* the system works, *why* key decisions were made, and *where* the important boundaries live.

## Current (on simple-steps-core)

Start here. These describe the system as built on `simple-steps-core`
(2026-10-23, core `86170a3`).

| Document | Description |
|---|---|
| [Object Model](./10-object-model.md) | Every object, core's and the app's — workflow, step, operation, output, kernel, cell — and how formula text becomes a grid |
| [Data Flow & Storage](./11-data-flow-and-storage.md) | Where data lives and how it moves between server and browser: today, what's wrong with it, and the Jupyter-shaped target |
| [Core and App](./12-core-and-app.md) | What `simple-steps-core` owns and what this repo owns, the rules at the line, and how a change crosses it |

## Earlier documents

Written before the app moved its engine to `simple-steps-core`. Parts are out
of date — notably the formula syntax (`=op.map(…)` is now the older syntax),
the engine (core runs core-syntax steps), and the data flow. Read the current
documents above first.

| Document | Description |
|---|---|
| [Architecture Overview](./01-architecture-overview.md) | High-level system architecture, component map, and data flow |
| [Formula System](./02-formula-system.md) | The formula bar as the single source of truth — parsing, building, quoting rules, and bidirectional sync |
| [Orchestration Engine](./03-orchestration-engine.md) | How the backend executes operations — wrappers, reference passing, and the DATA_STORE |
| [Operation Registration](./04-operation-registration.md) | `@simple_step` decorator, `register_operation()`, registry structure, and parameter inference |
| [Frontend Architecture](./06-frontend-architecture.md) | React component tree, state management via `useWorkflow`, and the wiring context |
| [Data Flow & API Contract](./07-data-flow-api-contract.md) | REST API endpoints, request/response shapes, reference-passing pattern, and the step map |
| [Pipeline Persistence](./08-pipeline-persistence.md) | Save/load lifecycle, `PipelineFile` model, hydration logic, and backward compatibility |

## Reading Order

If you're new to the codebase, read the **Object Model**, then **Core and App**, then **Data Flow & Storage**. The earlier documents are background on how the app worked before core.
