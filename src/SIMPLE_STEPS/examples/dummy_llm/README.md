# Dummy LLM — resources

A *resource* is an object steps use that isn't data: a database connection, a
language model. Here they're deterministic dummies — a `FakeDB` (city →
region) and `FakeLLM` / `TinyLLM` models that answer `[model] PROMPT` — so
every answer can be checked exactly. A real local model is optional.

```bash
simple-steps run examples/dummy_llm/app.py
python examples/dummy_llm/runme.py
```

| file | what it is |
|---|---|
| [`llm_tools.py`](llm_tools.py) | the resource types and the tools that use them |
| [`llm_resources.py`](llm_resources.py) | what the app offers: the types, and ready-made `house_llm` / `local_llm` |
| [`local_llm.py`](local_llm.py) | `OllamaLLM`: a real model served by Ollama |
| [`llm_pipeline.py`](llm_pipeline.py) | the `resources` workflow in Python, and the objects it runs with |

## Three marks

- `@simple_step_resource` on a class declares a resource **type**, built from
  literal settings.
- `@simple_step_tool` on one of its methods makes it a **bound tool**:
  `res["db"].lookup[mod.map()](wf["keys"])`. Unmarked methods
  (`FakeDB.reset`) are never tools.
- `@simple_step_tool` on a function with a resource-typed parameter makes an
  **unbound tool**: `enrich(city, db: FakeDB)`, written
  `enrich[mod.map()](wf["readings"], db=res["db"])`.

## The `resources` workflow

The saved file declares which instances exist, and steps name them with
`res["…"]`. It never holds an object; the app builds each one the first time
a step uses it, once per session.

```jsonc
"resources": {"db":   {"source": "defined", "type": "FakeDB"},
              "llm":  {"source": "defined", "type": "FakeLLM", "settings": {"model": "fake-1"}},
              "tiny": {"source": "defined", "type": "TinyLLM", "settings": {"model": "tiny-1"}},
              "house_llm": {"source": "loaded", "type": "FakeLLM",
                            "as_loaded": {"model": "house-1"}, "overrides": {"model": "house-2"}}}
```

| step | formula | gives |
|---|---|---|
| `regions` | `enrich[mod.map()](wf["readings"], db=res["db"])` | `west`, `east`, … |
| `summaries` | `summarize[mod.map()](wf["notes"], llm=res["llm"])` | `[fake-1] A`, `[fake-1] B` |
| `tiny_summaries` | `summarize[mod.map()](wf["notes"], res["tiny"])` | by position, matched by type: a `TinyLLM` fits `llm: LLM` |
| `regions_bound` | `res["db"].lookup[mod.map()](wf["keys"])` | a bound tool |
| `hello` | `res["llm"].complete[mod.source()](prompt="hi")` | `[fake-1] HI` |
| `inferred` | `res["db"].lookup(wf["keys"])` | the verb inferred: map |
| `house_summaries` | `summarize[mod.map()](wf["notes"], llm=res["house_llm"])` | `[house-2] A` — the saved override wins |

**Ready-made resources** come from the deployment, not the workflow:
`App(loaded={"house_llm": Loaded(FakeLLM, model="house-1")})`, with
`env("NAME")` for credentials. A workflow that changes a setting saves only
the change, so the deployment's settings apply underneath. In the UI, the
toolbar's **Resources** menu lists them under *From the deployment*.

## A real local model (optional)

`OllamaLLM` calls a model served by [Ollama](https://ollama.com) on this
machine, with the standard library only. The app offers it as
`res["local_llm"]` **only when it can be loaded**; otherwise it starts as
usual and prints why:

```
ⓘ  local_llm not loaded: Ollama isn't answering at http://localhost:11434 (…)
```

A small model is enough — `llama3.2:3b` (about 2 GB):

```bash
ollama pull llama3.2:3b
python examples/dummy_llm/runme.py      # now runs local-llm too
```

Use another with `OLLAMA_MODEL=…` or `OLLAMA_HOST=…`. `OllamaLLM` is an
`LLM`, so it fits any tool that takes one. The `local-llm` workflow has no
Python twin — a real model's words can't be predicted — so `runme.py` checks
only that each answer is non-empty text, and skips it without Ollama.
