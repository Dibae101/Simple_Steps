"""
example_check.py — run a saved workflow the way the UI does, and check it.

The examples' ``runme.py`` scripts are built on this. For each saved workflow
(``workspace/projects/<project>/<name>.simple-steps-workflow``) it:

1. runs every step the way the UI's Run does — the formula parsed, the
   previous step's output as the input, a step map of names and ``stepN``
   aliases, the workflow's ``resources`` section — through the same
   ``engine.run_operation`` that ``/api/run`` calls;
2. runs the same workflow written in Python (its *twin*: one line per step,
   in core's syntax) directly in ``simple_steps_core``, step by step;
3. compares every step's output between the two, and checks any explicit
   expectations, so a bug both share can't pass unnoticed.

A typical ``runme.py``::

    from SIMPLE_STEPS.example_check import Example

    example = Example(HERE / "app.py")       # imports the app: its tools, resources
    import pipeline                          # the twin, written against those tools

    example.check("basic", "all-orchestrations", twin=pipeline.build,
                  expect={"n_rows": {"value": [4]}})
    sys.exit(example.finish())

One process serves one App (``application.py``), so an :class:`Example` is
built once per process, before anything imports ``SIMPLE_STEPS.main``.
"""

from __future__ import annotations

import contextlib
import io
import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Mapping, Optional, Union

import numpy as np
import pandas as pd

#: The session every check runs in, so live resources are built once per run.
SESSION = "example-check"

#: What an expectation can be: ``{column: [values]}``, or a function of the
#: step's output and metrics that returns True, or a string saying what's wrong.
Expectation = Union[Mapping[str, List[Any]], Callable[[pd.DataFrame, dict], Union[bool, str]]]


@dataclass
class StepRun:
    """One step of a saved workflow, as the app ran it."""

    name: str
    expression: str
    data: Optional[pd.DataFrame] = None     # the output, as a table
    metrics: dict = field(default_factory=dict)
    error: Optional[str] = None             # set when the run refused or failed


class Example:
    """The app an example's workflows run in, and the tally of its checks."""

    def __init__(self, app_path: Union[str, Path]):
        from .application import _configure_environment, load_app_file

        self.app = load_app_file(str(app_path))
        _configure_environment(self.app)
        with contextlib.redirect_stdout(io.StringIO()):
            import SIMPLE_STEPS.main  # noqa: F401  — configures the server for this App
        self.workspace = Path(self.app.workspace)
        self.passed = self.failed = self.skipped = 0

    # ── what the app offers ──────────────────────────────────────────────

    @staticmethod
    def tools() -> Dict[str, Callable]:
        """The app's tools as core's tools dict — what a twin runs with."""
        from .grid_runner import _tools
        return _tools()

    def workflow(self, project: str, name: str) -> dict:
        """A saved workflow file from this example's workspace."""
        path = self.workspace / "projects" / project / f"{name}.simple-steps-workflow"
        return json.loads(path.read_text())

    # ── running ──────────────────────────────────────────────────────────

    def run_saved(self, project: str, name: str) -> Dict[str, StepRun]:
        """Every step of a saved workflow, run the way the UI runs it."""
        from .engine import get_value, run_operation
        from .formula_parser import parse_formula

        saved = self.workflow(project, name)
        resources = saved.get("resources") or None
        runs: Dict[str, StepRun] = {}
        refs: Dict[str, str] = {}
        previous = None
        for step in saved["steps"]:
            name_, expression = step["name"], step["expression"]
            run = runs[name_] = StepRun(name_, expression)
            formula = "=" + expression
            parsed = parse_formula(formula).as_dict()
            step_map = dict(refs)
            step_map.update({f"step{i + 1}": ref for i, ref in enumerate(refs.values())})
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    ref, run.metrics = run_operation(
                        parsed.get("operationId"), parsed.get("args") or {}, previous,
                        step_map, False, formula, name_, SESSION, None, resources,
                    )
            except Exception as exc:          # the step refused or failed: say why
                run.error = str(exc)
                continue
            refs[name_] = previous = ref
            run.data = as_table(get_value(ref, session_id=SESSION))
        return runs

    def run_twin(self, workflow, live: Optional[dict] = None) -> Dict[str, pd.DataFrame]:
        """Every step of a twin (a declared ``grid.Workflow``), run one at a
        time in order, as the UI runs them — so a step with failed rows doesn't
        stop the steps after it."""
        tools = self.tools()
        out: Dict[str, pd.DataFrame] = {}
        for sid in workflow.steps:
            workflow.run(sid, tools, resources=live or {})
            out[sid] = workflow.step(sid).output.data
        return out

    # ── checking ─────────────────────────────────────────────────────────

    def check(self, project: str, name: str, *,
              twin: Optional[Callable[[], Any]] = None,
              live: Optional[Callable[[], dict]] = None,
              expect: Optional[Mapping[str, Expectation]] = None,
              skip: Optional[Callable[[], Optional[str]]] = None) -> bool:
        """Run one saved workflow and check every step.

        *twin* builds the same workflow in Python (declared, not run); each
        step's output must match the app's. *live* returns the resource
        objects the twin runs with. *expect* adds explicit checks per step.
        *skip* returns a reason to skip the whole workflow, or None.
        """
        print(f"── {project}/{name}")
        reason = skip() if skip else None
        if reason:
            print(f"SKIP  {reason}\n")
            self.skipped += 1
            return True

        runs = self.run_saved(project, name)
        python = self.run_twin(twin(), live() if live else None) if twin else {}
        missing = set(python) - set(runs) if twin else set()
        expect = dict(expect or {})
        ok = True
        for sid, run in runs.items():
            problems = []
            if run.error:
                problems.append(f"the app refused it: {run.error[:300]}")
            else:
                if twin:
                    if sid not in python:
                        problems.append("the Python twin has no step with this name")
                    else:
                        problems += _differences(run.data, python[sid])
                if sid in expect:
                    problems += _unmet(expect.pop(sid), run)
            self._report(run, problems)
            ok &= not problems
        for sid in sorted(missing):
            self._report(StepRun(sid, "(only in the Python twin)"), ["the saved workflow has no such step"])
            ok = False
        for sid in sorted(expect):
            self._report(StepRun(sid, "(expected)"), ["the saved workflow has no such step"])
            ok = False
        print()
        return ok

    def _report(self, run: StepRun, problems: List[str]) -> None:
        if problems:
            self.failed += 1
            print(f"FAIL  {run.name:16} {run.expression}")
            for problem in problems:
                print(f"      {problem}")
        else:
            self.passed += 1
            print(f"PASS  {run.name:16} {run.expression}")

    def finish(self) -> int:
        """Print the tally; the exit code is 1 if any step failed."""
        total = self.passed + self.failed
        skipped = f", {self.skipped} workflow(s) skipped" if self.skipped else ""
        print(f"{self.passed}/{total} steps as expected{skipped}")
        return 1 if self.failed else 0


def tool_handles(*names: str):
    """Core tool handles for the app's tools (and core's builtins), by name —
    what a twin writes its steps with::

        scale, is_big = tool_handles("scale", "is_big")
        wf["scored"] = scale[mod.map(name="score")](wf["readings"])

    Each handle carries the app's own function, so the twin runs exactly the
    code the app runs, and nothing is registered with core a second time.
    """
    from simple_steps_core import grid
    from .grid_runner import _tools

    table = {**grid.builtin_tools(), **_tools()}
    missing = [n for n in names if n not in table]
    if missing:
        raise KeyError(f"no tool named {', '.join(missing)}; is the example's app imported?")
    handles = tuple(grid.ToolHandle(table[n], n) for n in names)
    return handles[0] if len(handles) == 1 else handles


# ─────────────────────────────────────────────────────────────────────────────
# Comparing outputs
# ─────────────────────────────────────────────────────────────────────────────

def as_table(value: Any) -> pd.DataFrame:
    """A step's output as a table: a DataFrame as it is, any other value
    (a list, a dict, a number) as core holds it — one cell."""
    if isinstance(value, pd.DataFrame):
        return value
    from simple_steps_core import grid
    return grid.grid(value).data


def _differences(app: pd.DataFrame, python: pd.DataFrame) -> List[str]:
    """How the app's output differs from the twin's, or [] if it doesn't."""
    app, python = app.reset_index(drop=True), python.reset_index(drop=True)
    if [str(c) for c in app.columns] != [str(c) for c in python.columns]:
        return [f"columns: app {list(app.columns)}, Python {list(python.columns)}"]
    if len(app) != len(python):
        return [f"rows: app {len(app)}, Python {len(python)}"]
    for column in app.columns:
        for i, (a, b) in enumerate(zip(app[column], python[column])):
            if not same(a, b):
                return [f"{column}[{i}]: app {_short(a)}, Python {_short(b)}"]
    return []


def _unmet(expectation: Expectation, run: StepRun) -> List[str]:
    """What an expectation finds wrong with a step's output, or []."""
    if callable(expectation):
        verdict = expectation(run.data, run.metrics)
        if verdict is True:
            return []
        return [f"expected: {verdict if isinstance(verdict, str) else 'check failed'}"]
    problems = []
    for column, values in expectation.items():
        if column not in run.data.columns:
            problems.append(f"expected a column {column!r}; it has {list(run.data.columns)}")
        elif not same(list(run.data[column]), list(values)):
            problems.append(f"expected {column} = {_short(list(values))}, got {_short(list(run.data[column]))}")
    return problems


def same(a: Any, b: Any) -> bool:
    """Whether two cell values are the same result: missing values (None, NaN,
    pd.NA) match each other, floats match within rounding, arrays, tables and
    Plotly figures by content, and a tuple matches the list JSON makes of it."""
    if _missing(a) or _missing(b):
        return _missing(a) and _missing(b)
    if isinstance(a, np.ndarray) or isinstance(b, np.ndarray):
        return np.array_equal(np.asarray(a), np.asarray(b))
    if isinstance(a, pd.DataFrame) or isinstance(b, pd.DataFrame):
        return (isinstance(a, pd.DataFrame) and isinstance(b, pd.DataFrame)
                and not _differences(a, b))
    if hasattr(a, "to_plotly_json") or hasattr(b, "to_plotly_json"):
        return (hasattr(a, "to_json") and hasattr(b, "to_json")
                and json.loads(a.to_json()) == json.loads(b.to_json()))
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return len(a) == len(b) and all(same(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(same(a[k], b[k]) for k in a)
    if isinstance(a, (float, np.floating)) or isinstance(b, (float, np.floating)):
        try:
            return math.isclose(float(a), float(b), rel_tol=1e-9, abs_tol=1e-12)
        except (TypeError, ValueError):
            return False
    return bool(a == b)


def _missing(value: Any) -> bool:
    if value is None or value is pd.NA or value is pd.NaT:
        return True
    return isinstance(value, (float, np.floating)) and math.isnan(value)


def _short(value: Any) -> str:
    text = repr(value)
    return text if len(text) <= 120 else text[:117] + "..."
