"""
order_tools.py — the agent example's tools: a small shop's orders.

These are ordinary tools; what makes them agent-friendly is how they're
written. The agent reads each tool's name, signature and the first line of its
docstring (``agent/scope.py``) and nothing else, so:

- the **name** says what the tool does: ``line_total``, not ``calc``;
- **parameters are named after the columns they read** — ``price``,
  ``quantity`` — so the agent can see which step a tool fits;
- the docstring's **first line** is a plain sentence a user might say;
- **type hints** say what comes back: ``-> bool`` tells the agent (and
  core) it's a filter.

The file imports nothing from its folder, so the main example can import it
as ``agent_demo.order_tools``.

    simple-steps run examples/agent_demo/app.py
    python examples/agent_demo/runme.py
    python examples/agent_demo/ask.py
"""

from __future__ import annotations

import random

import pandas as pd

from SIMPLE_STEPS import simple_step_tool

CITIES = ["Lisbon", "Osaka", "Nairobi", "Quito"]
PRODUCTS = {"tea": 4.5, "mug": 12.0, "kettle": 39.0, "teapot": 28.0}


@simple_step_tool(category="Orders")
def sample_orders(count: int = 12, seed: int = 0) -> pd.DataFrame:
    """A table of sample shop orders: order_id, date, city, product, price, quantity.

    A source: it reads no step. ``seed`` picks a different, repeatable set.

    Args:
        count: how many orders.
        seed: which random set of orders.
    """
    rng = random.Random(seed)
    rows = []
    for i in range(count):
        product = rng.choice(sorted(PRODUCTS))
        rows.append({
            "order_id": 1001 + i,
            "date": f"2026-{rng.randint(1, 3):02d}-{rng.randint(1, 28):02d}",
            "city": rng.choice(CITIES),
            "product": product,
            "price": PRODUCTS[product],
            "quantity": rng.randint(1, 6),
        })
    return pd.DataFrame(rows)


@simple_step_tool(category="Orders")
def line_total(price: float, quantity: int) -> float:
    """An order's total: its price times its quantity.

    Args:
        price: the price of one item.
        quantity: how many were ordered.
    """
    return round(price * quantity, 2)


@simple_step_tool(category="Orders")
def is_large_order(total: float, threshold: float = 100) -> bool:
    """Whether an order's total is over a threshold — keep the large orders.

    Args:
        total: the order's total.
        threshold: the smallest total that counts as large.
    """
    return total > threshold


@simple_step_tool(category="Orders")
def month_of(date: str) -> str:
    """The month an order was placed, as YYYY-MM.

    Args:
        date: the order's date, YYYY-MM-DD.
    """
    return str(date)[:7]


@simple_step_tool(category="Orders")
def with_discount(total: float, percent: float = 10) -> float:
    """An order's total after a percentage discount.

    Args:
        total: the order's total.
        percent: the discount, in percent.
    """
    return round(total * (1 - percent / 100), 2)


@simple_step_tool(category="Orders")
def sum_totals(acc, total: float) -> float:
    """Revenue: the sum of the orders' totals (a reducer, for collapse).

    Args:
        acc: the sum so far.
        total: the next order's total.
    """
    return round((acc or 0) + total, 2)
