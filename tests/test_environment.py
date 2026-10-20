"""
What the Environment explorer is told about the app (spec 013).

TEST-ENV-01 covers REQ-ENV-001 (tools, typed, built-ins included, verbs not),
TEST-ENV-02 REQ-ENV-002 (resource parameters name the types that fit),
TEST-ENV-03 REQ-ENV-003 (resource types and ready-made resources), and
TEST-ENV-08 REQ-ENV-008 (the usage docs are part of the bundle's source hash).
"""
from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Literal

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from SIMPLE_STEPS import simple_step_resource, simple_step_tool
from SIMPLE_STEPS.main import app

ROOT = Path(__file__).resolve().parents[1]


class EnvModel:
    """A model — the base an annotation names."""


@simple_step_resource
class EnvFakeModel(EnvModel):
    """A fake model that answers in capitals."""

    def __init__(self, model: str = "env-1"):
        self.model = model

    @simple_step_tool
    def shout(self, prompt: str) -> str:
        """The prompt, in capitals.

        Args:
            prompt: what to shout.
        """
        return prompt.upper()


@simple_step_tool(id="env_scale", category="Env tests")
def env_scale(n: int, weight: float = 1.0, mode: Literal["up", "down"] = "up") -> float:
    """Scale a reading.

    Args:
        n: the reading.
        weight: multiplies it.
        mode: which way.
    """
    return n * weight


@simple_step_tool(id="env_ask", category="Env tests")
def env_ask(text: str, model: EnvModel) -> str:
    """Ask the model about a text."""
    return text


@simple_step_tool(id="env_rows", category="Env tests", operation_type="source")
def env_rows(count: int = 3) -> pd.DataFrame:
    """Some rows."""
    return pd.DataFrame({"n": range(count)})


@pytest.fixture(scope="module")
def env():
    r = TestClient(app).get("/api/environment")
    assert r.status_code == 200
    return r.json()


def _tool(env, tool_id):
    return next(t for t in env["tools"] if t["id"] == tool_id)


# ── TEST-ENV-01 · REQ-ENV-001 ────────────────────────────────────────────────

def test_a_tool_has_its_typed_contract(env):
    """REQ-ENV-001: Python types as written, defaults, choices, docstring text."""
    scale = _tool(env, "env_scale")
    assert scale["category"] == "Env tests"
    assert scale["origin"] == "declared"
    assert scale["description"].startswith("Scale a reading")
    assert scale["returns"] == "float"
    params = {p["name"]: p for p in scale["params"]}
    assert params["n"] == {**params["n"], "type": "int", "required": True, "description": "the reading."}
    assert params["weight"]["type"] == "float" and params["weight"]["default"] == 1.0
    assert params["weight"]["required"] is False
    assert params["mode"]["choices"] == ["up", "down"]


def test_a_source_tool_reports_its_table_output(env):
    """REQ-ENV-001: the palette's hints (kind, output form) come along."""
    rows = _tool(env, "env_rows")
    assert rows["kind"] == "source"
    assert rows["returns"] == "DataFrame"


def test_core_builtins_are_listed_after_the_apps_tools(env):
    """REQ-ENV-001: identity, gather, count… are tools a step can name."""
    ids = [t["id"] for t in env["tools"]]
    for builtin in ("identity", "gather", "count"):
        assert builtin in ids
        assert _tool(env, builtin)["origin"] == "builtin"
    origins = [t["origin"] for t in env["tools"]]
    assert origins.index("builtin") > max(i for i, o in enumerate(origins) if o != "builtin")


def test_verbs_and_orchestrators_are_not_tools(env):
    """REQ-ENV-001: map, filter, select… are modifiers, not tools."""
    kinds = {t["kind"] for t in env["tools"]}
    assert "verb" not in kinds and "orchestrator" not in kinds
    assert not {"map", "filter", "select"} & {t["id"] for t in env["tools"]}


# ── TEST-ENV-02 · REQ-ENV-002 ────────────────────────────────────────────────

def test_a_resource_parameter_names_the_types_that_fit(env):
    """REQ-ENV-002: `model: EnvModel` is a resource input, filled by EnvFakeModel."""
    params = {p["name"]: p for p in _tool(env, "env_ask")["params"]}
    assert params["model"]["type"] == "EnvModel"
    assert params["model"]["resource"] == ["EnvFakeModel"]
    assert "resource" not in params["text"]


# ── TEST-ENV-03 · REQ-ENV-003 ────────────────────────────────────────────────

def test_resource_types_carry_settings_bases_and_bound_tools(env):
    """REQ-ENV-003: a type's settings and its marked methods, typed."""
    entry = env["resource_types"]["EnvFakeModel"]
    assert entry["description"].startswith("A fake model")
    assert entry["settings"] == [{"name": "model", "type": "str", "required": False, "default": "env-1"}]
    assert "EnvModel" in entry["bases"]
    shout = entry["tools"]["EnvFakeModel.shout"]
    assert shout["returns"] == "str"
    assert shout["params"][0]["name"] == "prompt" and shout["params"][0]["type"] == "str"


def test_ready_made_resources_are_listed(env):
    """REQ-ENV-003: the deployment's resources, as /api/resources/loaded serves them."""
    loaded = TestClient(app).get("/api/resources/loaded").json()
    assert env["resources"] == loaded


# ── TEST-ENV-08 · REQ-ENV-008 ────────────────────────────────────────────────

def _build_frontend():
    path = ROOT / "src" / "SIMPLE_STEPS" / "build_frontend.py"
    spec = importlib.util.spec_from_file_location("_ss_build_frontend_test", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_a_docs_change_marks_the_bundle_stale(tmp_path):
    """REQ-ENV-008: editing a usage doc changes the source hash preflight checks."""
    src = tmp_path / "frontend" / "src"
    docs = tmp_path / "docs" / "usage_docs"
    src.mkdir(parents=True)
    docs.mkdir(parents=True)
    (src / "main.tsx").write_text("export {};\n")
    (docs / "01-concepts.md").write_text("# Concepts\n")
    source_hash = _build_frontend().source_hash
    before = source_hash(str(src))
    (docs / "01-concepts.md").write_text("# Concepts\n\nMore.\n")
    assert source_hash(str(src)) != before
    (docs / "notes.txt").write_text("not a doc")          # only .md is bundled
    after = source_hash(str(src))
    (docs / "notes.txt").write_text("still not a doc")
    assert source_hash(str(src)) == after
