"""
bad_tools.py — the tools the bad examples misuse, and the ones that fix them.

Each is correct in itself; the mistakes are in how a step uses them
(``bad_cases.py``). The pairs — ``add_one`` / ``add_one_or_zero``,
``describe_text`` / ``describe_rows`` — are a tool written wrong for its use
and one written right.
"""

from __future__ import annotations

import pandas as pd

from SIMPLE_STEPS import simple_step_tool


@simple_step_tool(category="Bad examples")
def double_n(n: int) -> int:
    """Twice a reading.

    Args:
        n: the reading.
    """
    return n * 2


@simple_step_tool(category="Bad examples")
def greet(name: str) -> str:
    """A greeting for a name.

    Args:
        name: who to greet.
    """
    return f"hi {name}"


@simple_step_tool(category="Bad examples")
def label(city: str) -> str:
    """A city's label.

    Args:
        city: the city.
    """
    return f"city of {city}"


@simple_step_tool(category="Bad examples")
def add_one(n: int) -> int:
    """One more — for a column with no gaps: ``n`` can't be None.

    Args:
        n: the reading.
    """
    return n + 1


@simple_step_tool(category="Bad examples")
def add_one_or_zero(n: int | None) -> int:
    """One more, or 0 for a missing reading: ``n`` may be None.

    Args:
        n: the reading, or None.
    """
    return 0 if n is None else n + 1


@simple_step_tool(category="Bad examples")
def reciprocal(n: float) -> float:
    """1 / n — raises on 0.

    Args:
        n: the reading.
    """
    return 1 / n


@simple_step_tool(category="Bad examples")
def describe_text(df: pd.DataFrame) -> str:
    """A table, described in a sentence — text, not a table.

    Args:
        df: the table.
    """
    return f"{len(df)} rows, columns {', '.join(map(str, df.columns))}"


@simple_step_tool(category="Bad examples")
def describe_rows(df: pd.DataFrame) -> pd.DataFrame:
    """A table, described as a table: one row per column.

    Args:
        df: the table.
    """
    return pd.DataFrame({"column": [str(c) for c in df.columns],
                         "non_null": [int(df[c].notna().sum()) for c in df.columns]})
