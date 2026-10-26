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
from typing import Any, Dict, Optional, Tuple

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
