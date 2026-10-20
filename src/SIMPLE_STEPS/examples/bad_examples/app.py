"""
app.py — the bad examples as a Simple Steps application.

    simple-steps run examples/bad_examples/app.py
    python examples/bad_examples/app.py

Open ``mistakes`` to see each mistake refused or warned about — run its steps
one at a time, since Run All stops at the first refused step — and
``corrected`` for each one fixed. ``runme.py`` checks both.
"""

from pathlib import Path

from SIMPLE_STEPS import App

import bad_tools

app = App(
    tools=[bad_tools],
    workspace=str(Path(__file__).resolve().parent / "workspace"),
    title="Bad examples: mistakes and their fixes",
)

if __name__ == "__main__":
    app.serve()
