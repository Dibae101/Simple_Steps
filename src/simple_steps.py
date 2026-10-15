"""``python -m simple_steps run app.py`` — the ``simple-steps`` command, through the
interpreter. (A module name can't contain a hyphen, so ``python -m simple-steps``
is not possible; the package itself is ``SIMPLE_STEPS``.)
"""
from SIMPLE_STEPS.cli import main

if __name__ == "__main__":
    main()
