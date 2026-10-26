"""
runme.py — run the Prefab example's workflow and check every step.

    python examples/prefab_views/runme.py

``views`` runs the way the UI runs it, then is compared step by step with its
Python twin (``view_pipeline.py``) run straight in simple-steps-core — Prefab
views by their wire JSON. Each view is also checked by what it holds and by the
page the cell viewer opens for it. Needs prefab-ui; without it the workflow is
skipped and says how to install it. Exits non-zero if any step doesn't match.
"""

import sys
from pathlib import Path

from SIMPLE_STEPS.example_check import Example

HERE = Path(__file__).resolve().parent
example = Example(HERE / "app.py")

import view_pipeline as pipeline  # noqa: E402
from view_tools import prefab_missing  # noqa: E402

CITIES = ["SF", "NYC", "LA", "SF"]
NS = [1, 4, 2, 3]


def _nodes(node):
    """Every component of a wire tree, depth first."""
    if isinstance(node, dict):
        yield node
        for child in node.get("children") or []:
            yield from _nodes(child)


def cards(data, metrics):
    """A Prefab card per reading, each named by its city in the grid."""
    from SIMPLE_STEPS.cell_types import cell
    found = [cell(i, "card", v).get("summary") for i, v in enumerate(data["card"])]
    want = [f"Prefab view · Card · {c}" for c in CITIES]
    return found == want or f"card summaries {found}, want {want}"


def board(data, metrics):
    """One dashboard: three counts, a bar chart and the rows — and the page the
    viewer opens loads this app's renderer, the same page every time."""
    from SIMPLE_STEPS import cell_types, prefab_pages
    app = data["value"].iloc[0]
    if not prefab_pages.is_prefab_app(app):
        return f"not a PrefabApp: {type(app).__name__}"
    nodes = list(_nodes(prefab_pages.prefab_wire(app).get("view")))
    found = {n.get("label"): n.get("value") for n in nodes if n.get("type") == "Metric"}
    want = {"readings": 4, "total n": 10, "highest n": 4}
    if found != want:
        return f"metrics {found}, want {want}"
    types = [n.get("type") for n in nodes]
    if types.count("BarChart") != 1 or types.count("DataTable") != 1:
        return f"want one BarChart and one DataTable, got {types}"
    table = next(n for n in nodes if n.get("type") == "DataTable")
    rows = [(r.get("city"), r.get("n")) for r in table.get("rows") or []]
    if rows != list(zip(CITIES, NS)):
        return f"table rows {rows}, want {list(zip(CITIES, NS))}"
    page = cell_types.view(app)["view"]
    if page.get("kind") != "prefab" or not page.get("html"):
        return f"no Prefab page: {page.get('error')}"
    if f'src="{prefab_pages.renderer_base()}/renderer.js"' not in page["html"]:
        return "the page doesn't load this app's renderer"
    if cell_types.view(app)["view"]["html"] != page["html"]:
        return "opening the view twice gave different pages"
    js = prefab_pages.renderer_asset(prefab_pages.version(), "renderer.js")
    css = prefab_pages.renderer_asset(prefab_pages.version(), "renderer.css")
    if not (js and css and js[0].strip() and css[0].startswith(b"/*! tailwindcss")
            and b"import.meta" not in css[0]):
        return "the renderer didn't split into its script and its stylesheet"
    return True


def check_export() -> int:
    """TEST-PFB-31: the workflow's results export as one standalone page — the
    renderer pinned to the installed prefab-ui, strict JSON, text shown
    literally, titles escaped, a step that never ran said so. 0 if it holds."""
    import json
    from SIMPLE_STEPS import prefab_pages
    print("── prefab_views/export")
    if prefab_missing():
        print(f"SKIP  {prefab_missing()}\n")
        return 0
    wf = pipeline.build_views()
    wf.run_all()
    outputs = {name: wf.step(name).output.data for name in ("readings", "cards", "board")}
    steps = [{"name": n, "formula": f"={n}", "ref": n} for n in outputs]
    steps.append({"name": "</title><script>x</script> {{ y }}", "formula": "", "ref": None})
    shell = prefab_pages.export_page("</title><script>x</script>", steps,
                                     lambda ref: (ref in outputs, outputs.get(ref)))
    inner = prefab_pages.export_inner_page(shell)
    start = inner.rfind(prefab_pages._DATA_OPEN) + len(prefab_pages._DATA_OPEN)
    text = inner[start:inner.find("</script>", start)]
    problems = []
    try:
        data = json.loads(text, parse_constant=lambda c: (_ for _ in ()).throw(ValueError(c)))
    except ValueError as exc:
        problems.append(f"the page's data isn't strict JSON: {exc}")
        data = {}
    pinned = f"cdn.jsdelivr.net/npm/@prefecthq/prefab-ui@{prefab_pages.version()}/dist/app/renderer.js"
    if pinned not in inner:
        problems.append("the renderer isn't pinned to the installed prefab-ui")
    if "<script>x</script>" in shell or "<script>x</script>" in inner:
        problems.append("a title went into the page unescaped")
    if "{{ y }}" in json.dumps(data, ensure_ascii=False):
        problems.append("a step name's {{ … }} would be filled in by prefab")
    found = [n.get("type") for n in _nodes(data.get("view"))]
    if found.count("Card") < 4 + len(steps) or "BarChart" not in found or "Image" in found:
        problems.append(f"unexpected components: {sorted(set(found))}")
    if "Not run." not in json.dumps(data):
        problems.append("the step that never ran isn't marked")
    if problems:
        print("FAIL  export_page\n      → " + "\n      → ".join(problems) + "\n")
        return 1
    print(f"PASS  export_page      {len(shell):,} bytes, {len(steps)} steps\n")
    return 0


example.check("prefab_views", "views", twin=pipeline.build_views, skip=prefab_missing, expect={
    "readings": {"city": CITIES, "n": NS},
    "cards": cards,
    "board": board,
})

sys.exit(example.finish() or check_export())
