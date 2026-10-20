"""
The shipped examples run, and every step does what it should (spec 010).

TEST-EX-01 covers REQ-EX-003: each sub-example's ``runme.py`` passes — its
saved workflows, run the way the UI runs them, match their Python twins and
the expected values. TEST-EX-02 covers REQ-EX-004: the main example's
workflow, over every sub-example's tools, does too.

Each ``runme.py`` runs in its own process: one process serves one App.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

EXAMPLES = Path(__file__).resolve().parents[1] / "src" / "SIMPLE_STEPS" / "examples"


def _run(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, *args], capture_output=True, text=True, timeout=300)


# ── TEST-EX-01 · REQ-EX-003 ──────────────────────────────────────────────────

@pytest.mark.parametrize("name", ["basic", "dummy_llm", "plotly_charts"])
def test_sub_example_runme_passes(name):
    """REQ-EX-003: every step of the sub-example's saved workflows is as expected."""
    done = _run(str(EXAMPLES / name / "runme.py"))
    assert done.returncode == 0, done.stdout[-4000:] + done.stderr[-2000:]
    assert "steps as expected" in done.stdout


# ── TEST-EX-02 · REQ-EX-004 ──────────────────────────────────────────────────

def test_main_example_runme_passes():
    """REQ-EX-004: the main workflow, using every sub-example's tools, is as expected."""
    done = _run(str(EXAMPLES / "runme.py"), "--main-only")
    assert done.returncode == 0, done.stdout[-4000:] + done.stderr[-2000:]
    assert "PASS  all-examples" in done.stdout
