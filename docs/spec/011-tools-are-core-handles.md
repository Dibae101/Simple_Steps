# Specification: A tool is core's tool handle

`@simple_step_tool` returns an object that is both the app's tool and
simple-steps-core's `ToolHandle`, so a tool written in a module can be
imported and used in core's step syntax directly — the same formula in
Python as in a saved workflow:

```python
from basic.basic_tools import scale
wf["scored"] = scale[mod.map(name="score")](wf["readings"])
```

- **REQ-TOOL-001:** a decorated tool is a `grid.ToolHandle` whose `id` is
  the tool id and whose function is the decorated function.
  `tool[mod.verb(…)](wf["x"])` and `tool(wf["x"])` declare a core step that
  runs that function, without the tool being added to core's tool registry
  (`grid.TOOLS`).
- **REQ-TOOL-002:** any other call is the app's call, unchanged: a plain call
  runs the function, `apply=` and `__mode=` keep their list behaviour, and
  `run_raw` / `apply_across_rows` / `apply_and_flatten` still work. The
  tool keeps its function's name, docstring and signature.
