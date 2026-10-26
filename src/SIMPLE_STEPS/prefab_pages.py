"""
prefab_pages.py — the pages that show Prefab views (docs/spec/015-prefab-views.md).

A tool may return a Prefab component or a ``PrefabApp`` (the optional
``prefab-ui`` package). The grid shows it as a ``prefab`` cell (an icon and a
summary, ``cell_types.py``); opening the cell shows a whole page built here,
which the viewer puts in a sandboxed iframe as its ``srcdoc``.

- The page comes from prefab-ui's own export code, ``PrefabApp.html()`` (what
  ``prefab export`` writes), with its renderer pointed at this server
  (``/api/prefab/renderer/<version>/``), so views work offline and match the
  installed version exactly.
- prefab-ui ships its renderer only inline, in one page. :func:`renderer_asset`
  splits that page's module script and stylesheet out once per process, and
  ``main.py`` serves them with ``Access-Control-Allow-Origin: *``: a sandboxed
  iframe has an opaque origin, and the browser refuses module scripts from it
  without that header.
- Pages are made from a deep copy, so opening a cell never changes the step's
  stored output (``to_json()`` stamps the user's root component).
- Views are display-only: Prefab actions that need an MCP host (``CallTool``,
  ``SendMessage``) do nothing here. Client-side state (tabs, toggles) works.

prefab-ui is imported only inside functions, so this module imports without it.
"""

from __future__ import annotations

import copy
import functools
import html as _html
import json
import logging
import math
import re
from typing import Any, Callable, Dict, Optional, Tuple

log = logging.getLogger(__name__)

#: Where ``main.py`` serves the renderer; the installed version follows.
RENDERER_PATH = "/api/prefab/renderer"
#: What a tool or check says when prefab-ui isn't installed.
INSTALL_HINT = 'Prefab views need prefab-ui: pip install "simple-steps[prefab]"'

_DATA_OPEN = '<script id="prefab:initial-data" type="application/json">'
_OPEN_JS = '<script type="module" crossorigin>'

#: Runs first in a cell's page: tells the viewer when the renderer can't load
#: or crashes, so the panel says so instead of staying blank. A broken image in
#: a user's view isn't a renderer failure, and the ResizeObserver notice is benign.
CELL_REPORTER = """<script>
(function () {
  function report(message) {
    try {
      parent.postMessage({source: "simple-steps-prefab", type: "error",
                          message: String(message).slice(0, 500)}, "*");
    } catch (e) {}
  }
  window.addEventListener("error", function (e) {
    var t = e.target;
    if (t && t !== window) {
      if (t.tagName === "SCRIPT" || (t.tagName === "LINK" && /stylesheet/i.test(t.rel || "")))
        report("couldn't load " + (t.src || t.href));
      return;
    }
    var m = String(e.message || "");
    if (/^ResizeObserver loop/.test(m)) return;
    report(m || "the Prefab renderer failed");
  }, true);
})();
</script>"""


class PrefabPageError(RuntimeError):
    """A Prefab page couldn't be built as expected."""


def prefab_missing() -> Optional[str]:
    """Why Prefab views can't be shown, or None when prefab-ui is installed."""
    try:
        import prefab_ui  # noqa: F401
    except ImportError:
        return INSTALL_HINT
    return None


def version() -> str:
    """The installed prefab-ui version."""
    from prefab_ui import __version__
    return __version__


def renderer_base() -> str:
    """The URL the in-app pages load the renderer from (relative, so it works
    through the Vite dev proxy and from the bundled UI alike)."""
    return f"{RENDERER_PATH}/{version()}"


# ─────────────────────────────────────────────────────────────────────────────
# What a value is
# ─────────────────────────────────────────────────────────────────────────────

def _has_base(value: Any, module: str, name: str) -> bool:
    return any(getattr(k, "__module__", "") == module and k.__name__ == name
               for k in type(value).__mro__)


def is_prefab_app(value: Any) -> bool:
    """A ``prefab_ui.app.PrefabApp`` (or a subclass), without importing prefab_ui."""
    return _has_base(value, "prefab_ui.app", "PrefabApp")


def is_prefab(value: Any) -> bool:
    """A Prefab component or ``PrefabApp``, subclasses included."""
    return is_prefab_app(value) or _has_base(value, "prefab_ui.components.base", "Component")


def _copy(value: Any) -> Any:
    """A copy that is safe to serialize, so the caller's object is never
    touched. The only thing prefab's ``to_json()`` writes is an app's root
    ``Div`` (it stamps ``pf-app-root`` on it), so the app and its root are
    copied; nothing deeper is written. A deep copy isn't possible: prefab's
    ``Rx`` values refuse to be copied that way."""
    if is_prefab_app(value):
        view = value.view
        if view is not None and not isinstance(view, dict) and hasattr(view, "model_copy"):
            return value.model_copy(update={"view": view.model_copy()})
        return value.model_copy()
    return value.model_copy() if hasattr(value, "model_copy") else copy.copy(value)


def prefab_wire(value: Any) -> Dict[str, Any]:
    """The Prefab wire JSON of *value* — what the renderer draws. A
    ``PrefabApp``'s title is added (its ``to_json()`` leaves it out)."""
    wire = _copy(value).to_json()
    if is_prefab_app(value):
        return {"title": value.title, **wire}
    return wire


# ─────────────────────────────────────────────────────────────────────────────
# Pages
# ─────────────────────────────────────────────────────────────────────────────

def _as_app(value: Any, title: str) -> Any:
    """A ``PrefabApp`` to render: a copy of the user's app, or a bare component
    wrapped in one."""
    if is_prefab_app(value):
        return _copy(value)
    from prefab_ui.app import PrefabApp
    return PrefabApp(title=title, view=_copy(value))


def _render(app: Any, renderer_mode: str) -> str:
    """``app.html()`` with the page title escaped: prefab writes ``title`` into
    ``<title>`` as it is, and a title is data (a workflow name, a heading)."""
    title = app.title if isinstance(app.title, str) else ""
    safe = app.model_copy(update={"title": _html.escape(title, quote=False)})
    return safe.html(renderer_mode=renderer_mode)


def _finite(value: Any) -> Any:
    """*value* with NaN and ±Inf replaced by None (they aren't JSON)."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {k: _finite(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_finite(v) for v in value]
    return value


def _strict_json(page: str) -> str:
    """Make the page's baked data strict JSON. prefab sanitizes ``state`` but
    not the view, so a NaN in a table would stop the renderer parsing it.
    Every ``<`` is escaped, so no data can end or confuse the script element."""
    start = page.rfind(_DATA_OPEN)
    if start < 0:
        raise PrefabPageError(f"prefab-ui {version()} wrote a page without its data block")
    body = start + len(_DATA_OPEN)
    end = page.find("</script>", body)
    if end < 0:
        raise PrefabPageError(f"prefab-ui {version()} wrote an unterminated data block")
    data = _finite(json.loads(page[body:end]))
    text = json.dumps(data, separators=(",", ":"), ensure_ascii=True, allow_nan=False)
    return page[:body] + text.replace("<", "\\u003c") + page[end:]


def _inject(page: str, snippet: str) -> str:
    """Put *snippet* first in the page's ``<head>``."""
    i = page.find("<head>")
    if i < 0:
        raise PrefabPageError(f"prefab-ui {version()} wrote a page without <head>")
    i += len("<head>")
    return page[:i] + "\n" + snippet + page[i:]


def cell_page(value: Any, title: str = "Prefab view") -> Dict[str, Any]:
    """The cell viewer's payload for a Prefab value: ``{"kind": "prefab",
    "html": <page>, "title": …}``, or ``html: None`` and an ``error`` when the
    page can't be built (the panel shows the error instead of a blank frame)."""
    try:
        missing = prefab_missing()
        if missing:
            raise PrefabPageError(missing)
        base = renderer_base()
        page = _render(_as_app(value, title), base)
        if f'src="{base}/renderer.js"' not in page:
            raise PrefabPageError(f"prefab-ui {version()} ignored the renderer URL")
        page = _inject(_strict_json(page), CELL_REPORTER)
        return {"kind": "prefab", "html": page, "title": title}
    except Exception as exc:
        log.warning("Couldn't build a Prefab page", exc_info=True)
        return {"kind": "prefab", "html": None, "title": title,
                "error": f"{type(exc).__name__}: {exc}"}


# ─────────────────────────────────────────────────────────────────────────────
# The renderer, served by this app
# ─────────────────────────────────────────────────────────────────────────────

_MEDIA = {"renderer.js": "text/javascript; charset=utf-8",
          "renderer.css": "text/css; charset=utf-8"}


def _split(head: str, ver: str) -> Tuple[str, str]:
    """The module script and the stylesheet of prefab-ui's bundled head. Its JS
    contains ``<style>`` literals, so the style is the one element after the
    script, not the first ``<style>`` found."""
    if head.count(_OPEN_JS) != 1:
        raise PrefabPageError(f"prefab-ui {ver}: expected one module script in the renderer")
    start = head.index(_OPEN_JS) + len(_OPEN_JS)
    end = head.index("</script>", start)
    js, rest = head[start:end], head[end + len("</script>"):]
    match = re.fullmatch(r"\s*<style\b[^>]*>(.*)</style>\s*", rest, re.S)
    if not match or not js.strip():
        raise PrefabPageError(f"prefab-ui {ver}: the renderer isn't one script and one style")
    return js, match.group(1)


@functools.lru_cache(maxsize=1)
def _renderer_files(ver: str) -> Dict[str, bytes]:
    from prefab_ui.renderer import get_renderer_head
    js, css = _split(get_renderer_head(mode="bundled"), ver)
    return {"renderer.js": js.encode("utf-8"), "renderer.css": css.encode("utf-8")}


def renderer_asset(ver: str, name: str) -> Optional[Tuple[bytes, str]]:
    """``(body, media type)`` of ``renderer.js`` or ``renderer.css`` for the
    installed prefab-ui, or None for any other name or version (or no prefab-ui)."""
    if name not in _MEDIA or prefab_missing() or ver != version():
        return None
    return _renderer_files(ver)[name], _MEDIA[name]


# ─────────────────────────────────────────────────────────────────────────────
# Export: a workflow's results as one standalone Prefab page (REQ-PFB-030..032)
# ─────────────────────────────────────────────────────────────────────────────

#: Rows of a table, and items of an image or view column, put on the page.
EXPORT_TABLE_ROWS = 200
EXPORT_ITEMS = 50
#: Longest side of an exported image, and the most image data on one page.
EXPORT_IMAGE_SIDE = 512
EXPORT_IMAGE_BUDGET = 20_000_000

#: The exported page is opened outside the app (often from disk), so instead of
#: posting to a parent it says on the page itself why it couldn't be drawn.
EXPORT_REPORTER = """<script>
(function () {
  var shown = false;
  function show(text) {
    if (shown) return;
    shown = true;
    function put() {
      var box = document.createElement("div");
      box.setAttribute("role", "alert");
      box.style.cssText = "font:14px/1.45 system-ui,sans-serif;margin:16px;padding:12px 14px;" +
        "border:1px solid #d4a017;background:#fff8e1;color:#4d3a00;border-radius:6px";
      box.textContent = "This page couldn't be drawn: " + text;
      document.body.insertBefore(box, document.body.firstChild);
    }
    if (document.body) put(); else document.addEventListener("DOMContentLoaded", put);
  }
  window.addEventListener("error", function (e) {
    var t = e.target;
    if (t && t !== window) {
      if (t.tagName === "SCRIPT" || (t.tagName === "LINK" && /stylesheet/i.test(t.rel || "")))
        show("its renderer couldn't be loaded from cdn.jsdelivr.net (are you offline?)");
      return;
    }
    var m = String(e.message || "");
    if (/^ResizeObserver loop/.test(m)) return;
    show("one of its views is invalid (" + m.slice(0, 300) + ")");
  }, true);
})();
</script>"""

#: PrefabApp settings an inlined app can't bring onto a shared page.
_APP_ONLY = ("theme", "css", "stylesheets", "scripts", "js_pipes", "js_actions",
             "key_bindings", "mode", "defs")


class NothingToExport(PrefabPageError):
    """No step in the request has an output in this session."""


def _literal(text: Any) -> str:
    """*text* as prefab shows it literally: prefab fills in ``{{ … }}`` in every
    string from the page's state, so a zero-width space splits the braces."""
    return str(text).replace("{{", "{\u200b{")


def export_filename(title: str) -> str:
    """``<slug>-results.html`` for a workflow title."""
    slug = "-".join(re.findall(r"[a-z0-9]+", (title or "").lower()))[:60].strip("-")
    return f"{slug or 'workflow'}-results.html"


class _Export:
    """Builds the page's view: prefab's own components for everything this page
    writes, and the users' views spliced in as their wire JSON."""

    def __init__(self, load: Callable[[str], Tuple[bool, Any]]):
        self.load = load
        self.any_output = False
        self.state: Dict[str, Any] = {}
        self.slots: Dict[str, Dict[str, Any]] = {}
        self.image_bytes = 0

    # ── steps ────────────────────────────────────────────────────────────
    def step_card(self, name: str, formula: str, ref: Optional[str]) -> Any:
        from prefab_ui.components import (Card, CardContent, CardDescription, CardHeader,
                                          CardTitle, Code, Column, Muted)
        if not ref:
            what, body = "not run", [Muted("Not run.")]
        else:
            found, value = self.load(ref)
            if not found:
                what = "not in this session"
                body = [Muted("Its output isn't in this session any more; run it again to include it.")]
            else:
                self.any_output = True
                try:
                    what, body = self.output(name, value)
                except Exception as exc:
                    log.warning("Couldn't export a step's output", exc_info=True)
                    what, body = "output", [Muted(_literal(
                        f"Couldn't include this output: {type(exc).__name__}: {exc}"))]
        content = ([Code(_literal(formula), language="python")] if formula else []) + body
        return Card(children=[
            CardHeader(children=[CardTitle(_literal(name)), CardDescription(_literal(what))]),
            CardContent(children=[Column(gap=3, children=content)]),
        ])

    def output(self, name: str, value: Any) -> Tuple[str, list]:
        import pandas as pd
        if isinstance(value, pd.DataFrame):
            rows, cols = value.shape
            what = f"{rows} row{'' if rows == 1 else 's'} × {cols} column{'' if cols == 1 else 's'}"
            if rows == 1 and cols == 1:
                return what, [self.value(name, str(value.columns[0]), value.iloc[0, 0])]
            return what, self.table(name, value)
        if value is None:
            from prefab_ui.components import Muted
            return "one value", [Muted("empty")]
        return "one value", [self.value(name, "value", value)]

    # ── values ───────────────────────────────────────────────────────────
    def value(self, name: str, column: str, value: Any) -> Any:
        from prefab_ui.components import Metric, Muted, Text
        from .cell_types import _is_missing, cell_type_of
        kind = cell_type_of(value)
        if kind is None:
            if _is_missing(value):
                return Muted("empty")
            number = value.item() if hasattr(value, "item") and not isinstance(value, str) else value
            if (isinstance(number, (int, float)) and not isinstance(number, bool)
                    and math.isfinite(float(number))):
                return Metric(label=_literal(column), value=number)
            return Text(_literal(value))
        if kind.name == "prefab":
            return self.view(name, value, kind.summary(value))
        if kind.name == "image":
            return self.image(name, value, kind.summary(value))
        if kind.name == "table":
            return self.data_table(value)[0]
        return Text(_literal(kind.summary(value)))

    def view(self, name: str, value: Any, summary: str) -> Any:
        """A user's view, spliced in later; an app only if it fits on a shared page."""
        from prefab_ui.components import Div, Muted
        if is_prefab_app(value):
            app = _copy(value)
            clashes = [k for k, v in (app.state or {}).items() if k in self.state and self.state[k] != v]
            if any(getattr(app, field, None) for field in _APP_ONLY) or clashes:
                return Muted(_literal(f"{summary} — open it in Simple Steps; it can't share a page "
                                      "with the views above."))
            wire = app.to_json()
            node = wire.get("view")
            if isinstance(node, dict) and isinstance(node.get("cssClass"), str):
                css = " ".join(c for c in node["cssClass"].split() if c != "pf-app-root")
                node = {**node, "cssClass": css} if css else {k: v for k, v in node.items() if k != "cssClass"}
            self.state.update(wire.get("state") or {})
        else:
            node = _copy(value).to_json()
        key = f"ss-export-slot-{len(self.slots)}"
        self.slots[key] = node
        return Div(css_class=key)

    def image(self, name: str, value: Any, summary: str) -> Any:
        from prefab_ui.components import Image, Muted
        from .cell_types import _data_url, _image_png
        src = _data_url(_image_png(value, EXPORT_IMAGE_SIDE))
        if self.image_bytes + len(src) > EXPORT_IMAGE_BUDGET:
            return Muted(_literal(f"{summary} — too large for this page"))
        self.image_bytes += len(src)
        return Image(src=src, alt=_literal(name))

    # ── tables ───────────────────────────────────────────────────────────
    def table(self, name: str, df: Any) -> list:
        from prefab_ui.components import Grid, H4, Muted
        from .cell_types import _is_missing, cell_type_of
        parts: list = []
        plain = []
        for column in df.columns:
            values = [v for v in df[column].tolist() if not _is_missing(v)]
            kinds = {getattr(cell_type_of(v), "name", None) for v in values}
            if values and kinds in ({"image"}, {"prefab"}):
                items = [self.value(name, str(column), v) for v in values[:EXPORT_ITEMS]]
                parts += [H4(_literal(column)),
                          Grid(columns=4 if kinds == {"image"} else 2, gap=3, children=items)]
                if len(values) > EXPORT_ITEMS:
                    parts.append(Muted(f"Showing {EXPORT_ITEMS} of {len(values)}."))
            else:
                plain.append(column)
        if plain:
            parts = self.data_table(df[plain]) + parts
        return parts

    def data_table(self, df: Any) -> list:
        from prefab_ui.components import DataTable, DataTableColumn, Muted
        from .cell_types import cell_type_of, is_plain, jsonable
        columns = list(df.columns)
        keys = [f"c{i}" for i in range(len(columns))]
        rows = []
        for record in df.head(EXPORT_TABLE_ROWS).itertuples(index=False, name=None):
            row = {}
            for key, v in zip(keys, record):
                if is_plain(v):
                    v = jsonable(v)
                    row[key] = _literal(v) if isinstance(v, str) else v
                else:
                    kind = cell_type_of(v)
                    row[key] = _literal(kind.summary(v) if kind else repr(v))
            rows.append(row)
        table = DataTable(columns=[DataTableColumn(key=k, header=_literal(c)) for k, c in zip(keys, columns)],
                          rows=rows)
        out = [table]
        if len(df) > EXPORT_TABLE_ROWS:
            out.append(Muted(f"Showing {EXPORT_TABLE_ROWS} of {len(df)} rows."))
        return out

    # ── assembly ─────────────────────────────────────────────────────────
    def fill(self, node: Any) -> Any:
        """The wire tree with every placeholder replaced by its user view."""
        if isinstance(node, dict):
            css = node.get("cssClass")
            if isinstance(css, str) and css in self.slots:
                return self.slots[css]
            return {k: self.fill(v) for k, v in node.items()}
        if isinstance(node, list):
            return [self.fill(v) for v in node]
        return node


def export_page(title: str, steps: list, load: Callable[[str], Tuple[bool, Any]]) -> str:
    """One standalone HTML page of a workflow's step outputs, in request order.

    *steps* are ``{"name", "formula", "ref"}``; ``load(ref)`` returns
    ``(found, value)`` for this session. The page loads the renderer from
    jsDelivr, pinned to the installed prefab-ui, so whoever opens the file
    needs no Simple Steps; it says so on the page if the renderer can't load.
    Raises :class:`NothingToExport` when no step has an output.
    """
    import datetime as _dt
    from prefab_ui.app import PrefabApp
    from prefab_ui.components import Column, Heading, Muted

    title = (title or "").strip() or "Untitled"
    export = _Export(load)
    cards = [export.step_card((s.get("name") or "").strip() or f"Step {i + 1}",
                              s.get("formula") or "", s.get("ref"))
             for i, s in enumerate(steps)]
    if not export.any_output:
        raise NothingToExport("Nothing to export yet: run the workflow first.")
    n = len(steps)
    view = Column(gap=6, children=[
        Heading(_literal(title)),
        Muted(f"Exported from Simple Steps on {_dt.date.today().isoformat()} · {n} step{'' if n == 1 else 's'}"),
        *cards,
    ])
    page_title = _html.escape(f"{title} · results", quote=False)
    page = PrefabApp.model_construct(
        title=page_title,
        view=export.fill(view.to_json()),
        state=export.state or None,
    ).html(renderer_mode="cdn")
    if f"@prefecthq/prefab-ui@{version()}/" not in page:
        raise PrefabPageError(f"prefab-ui {version()} didn't pin its CDN renderer")
    page = _inject(_strict_json(page), '<meta charset="utf-8">\n' + EXPORT_REPORTER)
    return EXPORT_SHELL.format(title=page_title, page=_html.escape(page, quote=True))


#: The downloaded file is a thin shell with the page in a frame. As the
#: top-level window, prefab-ui 0.20.2's renderer finds no host (it messages
#: itself) and its charts then draw without their bars; inside a frame they
#: draw, as they do in the cell viewer. The frame fills the window.
EXPORT_SHELL = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>html,body{{margin:0;height:100%;background:#fff}}iframe{{display:block;width:100%;height:100%;border:0}}</style>
</head>
<body>
<iframe title="{title}" srcdoc="{page}"></iframe>
</body>
</html>
"""


def export_inner_page(shell: str) -> str:
    """The page inside an exported file's shell (for checks)."""
    match = re.search(r'srcdoc="([^"]*)"', shell)
    if not match:
        raise PrefabPageError("not an exported Prefab page")
    return _html.unescape(match.group(1))
