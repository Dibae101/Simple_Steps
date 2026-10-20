"""
bad_pipeline.py — the corrected workflow, written in Python.

The twin of ``workspace/projects/bad_examples/corrected.simple-steps-workflow``:
one Python line per saved step, each case's correction from ``bad_cases.py``.
``runme.py`` runs both and checks every step's output is the same.

The mistakes have no twin: they're the formulas that don't make a step.

Import this after the app (``runme.py`` does): the tools come from it.
"""

from __future__ import annotations

from simple_steps_core import grid
from simple_steps_core.grid import mod, stack

from SIMPLE_STEPS.example_check import tool_handles

(to_rows, identity, double_n, greet, label, add_one_or_zero, reciprocal, describe_rows) = tool_handles(
    "to_rows", "identity", "double_n", "greet", "label", "add_one_or_zero", "reciprocal", "describe_rows",
)


def build_corrected() -> grid.Workflow:
    wf = grid.Workflow()

    # the sources every case reads
    wf["readings"] = to_rows[mod.source()](data='{"city": ["SF", "NYC", "LA"], "n": [1, 0, 2]}')
    wf["more"] = to_rows[mod.source()](data='{"city": ["BOS"], "n": [5]}')
    wf["gappy"] = to_rows[mod.source()](data='{"n": [1, null, 3]}')
    wf["people"] = to_rows[mod.source()](data='{"first": ["Ada", "Bo"]}')
    wf["scored"] = double_n[mod.map()](wf["readings"])
    wf["people_named"] = identity[mod.rename(columns={"first": "name"})](wf["people"])

    # referring to steps
    wf["bare_name"] = double_n[mod.map()](wf["readings"])
    wf["quoted_name"] = double_n[mod.map()](wf["readings"])
    wf["missing_step"] = double_n[mod.map()](wf["readings"])
    wf["two_inputs"] = stack(wf["readings"], wf["more"])
    wf["row_selection"] = identity[mod.slice(stop=2)](wf["readings"])

    # tools and modifiers
    wf["unknown_tool"] = double_n[mod.map()](wf["readings"])
    wf["unknown_modifier"] = double_n[mod.map()](wf["readings"])
    wf["no_verb"] = double_n[mod.map(), mod.retry(times=2)](wf["readings"])
    wf["misspelt_setting"] = double_n[mod.map(name="doubled")](wf["readings"])
    wf["missing_setting"] = double_n[mod.map(), mod.retry(times=2)](wf["readings"])
    wf["setting_is_a_step"] = identity[mod.sort(by="n")](wf["readings"])
    wf["not_a_literal"] = greet[mod.map()](wf["readings"], name="ADA")

    # columns and types
    wf["missing_column"] = identity[mod.select(columns=["n"])](wf["readings"])
    wf["parameter_not_a_column"] = greet[mod.map()](wf["people_named"])
    wf["output_replaces_input"] = double_n[mod.map(name="doubled")](wf["readings"])
    wf["nullable_column"] = add_one_or_zero[mod.map()](wf["gappy"])
    wf["table_returns_text"] = describe_rows[mod.table()](wf["readings"])

    # ran, but warned
    wf["argument_hides_column"] = label[mod.map()](wf["readings"])
    wf["output_overwrites_value"] = double_n[mod.map(name="doubled_again")](wf["scored"])

    # ran, but rows failed
    wf["uncaught_failure"] = reciprocal[mod.map(), mod.try_except(default=0.0)](wf["readings"])
    return wf
