# Specification: What a run tells the user

Follow-ups A–C of [`core-proposals/009`](../core-proposals/009-decisions-to-confirm.md):
core (`9a86a0d`) reports more about a run than the app shows, and stops a
run on failures the app lets through.

## 1. Core's warnings reach the user

Core warns, rather than refuses, when a step is valid but probably not what
was meant (009 decisions 2 and 3):

- an explicit argument overrides a column of the same name for every row;
- a step's default output column replaces an input column of that name.

- **REQ-RUN-001:** `/api/run` metrics carry `warnings`: core's warnings for
  the step, as a list of strings, in core's words. The list is empty when
  there are none, and present for every step run on the grid.
- **REQ-RUN-002:** when a run has warnings, the log gets one `warn` entry
  naming the step, with each warning in its detail, and the step's summary
  panel lists them beside its status. A later run without warnings clears
  them.

## 2. Run All stops on a failure the step doesn't catch

Core's rule (009 decision 1): a failed cell stops the run unless the step
says it may fail, with `mod.try_except(…)`. A row blocked by an upstream
failure never stops a run by itself.

- **REQ-RUN-003:** `/api/run` metrics carry `uncaught_failed`: how many rows
  failed on their own (not blocked by an upstream failure) and were not caught
  by `mod.try_except`.
- **REQ-RUN-004:** Run All stops after a step whose `uncaught_failed` is
  more than zero: later steps don't run, and the log says which step stopped
  the run and how to let it through (`mod.try_except(…)`). The step keeps its
  output, so its failed cells can be inspected. A step with failed rows that
  `try_except` caught does not stop the run.

## 3. The suggested verb follows the input's data

Core infers some verbs differently before and after a step's input has run
(009 decision 6: K2 recognises only four accumulator names).

- **REQ-RUN-005:** while the step editor shows the verb `mod.auto()` (or a
  formula without brackets) resolves to, it asks core again whenever the
  input step's output changes — including when the input runs for the first
  time — so the suggestion matches what the next run will pick.
