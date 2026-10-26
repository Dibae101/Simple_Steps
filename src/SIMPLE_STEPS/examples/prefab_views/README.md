# prefab_views — Prefab views in cells

A tool can return a [Prefab](https://github.com/PrefectHQ/prefab) view: a
small interface built in Python with prefab-ui. The grid shows it as
`Prefab view · …`; clicking the cell opens the real view
([spec 015](../../../../docs/spec/015-prefab-views.md)).

```bash
pip install "simple-steps[prefab]"
simple-steps run examples/prefab_views/app.py
python examples/prefab_views/runme.py
```

| file | what it is |
|---|---|
| `view_tools.py` | `city_card` (a card per row, under `mod.map`) and `readings_board` (one dashboard of a whole table, under `mod.collapse`) |
| `app.py` | the application |
| `workspace/projects/prefab_views/views.simple-steps-workflow` | the saved workflow: readings → cards → board |
| `view_pipeline.py` | the same workflow in Python, one line per step |
| `runme.py` | runs both and checks every step, and the page each view opens |

Open `views`, press **Run All**, then click a card or the board. Views are
display-only: tabs, toggles and charts work; `CallTool` doesn't. Without
prefab-ui, each tool returns the install command as its cell's text and
`runme.py` skips the workflow.
