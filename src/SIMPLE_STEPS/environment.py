"""
environment.py — everything a workflow in this app can use, for the
Environment explorer (``GET /api/environment``, spec 013).

Tools come from core's own catalog (``grid.catalog``), so a parameter's type
is the Python annotation as written (``int``, ``LLM``, ``DataFrame``) — not
the palette's coarse form-field type — and core's built-in tools are listed
next to the app's. The palette's label, category and orchestration hint are
added from :data:`operations.DEFINITIONS` where the app has them.

Resources come from ``grid.resource_entry`` (types) and
:func:`resources.loaded_info` (the deployment's ready-made ones), exactly as
``/api/resources`` and ``/api/resources/loaded`` serve them.
"""

from __future__ import annotations

from typing import Any, Dict, List

from simple_steps_core import grid

#: Palette types that are not tools a step can name (spec 012: verbs are modifiers).
_NOT_TOOLS = ("verb", "orchestrator")


def describe_environment() -> Dict[str, Any]:
    """The tools, resource types and ready-made resources of this app."""
    from .grid_runner import _tools
    from .operations import DEFINITIONS
    from .resources import RESOURCE_TYPES, loaded_info

    palette = {op.id: op for op in DEFINITIONS}
    tools = {tool_id: fn for tool_id, fn in _tools().items()
             if getattr(palette.get(tool_id), "type", None) not in _NOT_TOOLS}

    resource_types = {name: grid.resource_entry(cls) for name, cls in sorted(RESOURCE_TYPES.items())}
    # A parameter typed LLM is a resource parameter if any declared type is, or
    # derives from, LLM: resource_entry lists each type's bases, itself included.
    fits: Dict[str, List[str]] = {}
    for name, entry in resource_types.items():
        for base in entry.get("bases") or [name]:
            fits.setdefault(base, []).append(name)

    entries = []
    for tool_id, entry in grid.catalog(tools).items():
        op = palette.get(tool_id)
        builtin = entry.get("origin") == "builtin"
        entries.append({
            "id": tool_id,
            "label": getattr(op, "label", None) or tool_id,
            "category": getattr(op, "category", None) or ("Built-in" if builtin else "Uncategorized"),
            "origin": entry.get("origin"),
            "kind": getattr(op, "type", None),
            # Core keeps the docstring's first line; the palette may have more.
            "description": max(entry.get("description") or "", getattr(op, "description", "") or "", key=len),
            "params": [_param(p, fits) for p in entry.get("params") or []],
            "returns": entry.get("returns"),
            "returns_form": getattr(getattr(op, "returns", None), "form", None),
        })
    entries.sort(key=lambda t: (t["origin"] == "builtin", t["category"].lower(), t["id"]))

    return {"tools": entries, "resource_types": resource_types, "resources": loaded_info()}


def _param(p: Dict[str, Any], fits: Dict[str, List[str]]) -> Dict[str, Any]:
    out = {
        "name": p.get("name"),
        "type": p.get("type"),
        "required": bool(p.get("required")),
        "default": p.get("default"),
        "choices": p.get("choices"),
        "nullable": bool(p.get("nullable")),
        "description": p.get("description") or "",
    }
    takes = fits.get(p.get("type") or "")
    if takes:
        out["resource"] = sorted(takes)
    return out
