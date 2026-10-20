# Specification: Switching a step's tool or verb

A step is edited by switching its parts: the tool from the editor's Tool
list, the verb and execution modifiers from its Modifiers list. Each switch
writes a new formula. The rule: **a formula the editor writes either runs,
or is refused when it is written, with the reason — never only when Run is
pressed.**

Found by running every registered tool against every shape verb through the
editor's own write path (`partsForTool` / `withShapeVerb` →
`format_parts` → `/api/run`): three edits wrote formulas that only failed at
run time, and one inferred verb leaked from the previous tool.

## 1. The compiler refuses what core would refuse at run

Core's rules, as `grid.modifier_catalog()` reports them; the formula compiler
checks them when a formula is written, so the formula bar and the step
editor show the reason as you type.

- **REQ-FORM-001:** a formula with more than one shape verb in its brackets
  (`auto` counts as one) is refused when compiled, saying which verbs and to
  split them into separate steps. Execution modifiers (`retry`, `timeout`, …)
  can be added to any shape verb.
- **REQ-FORM-002:** a verb that applies no tool (catalog `takes_tool` is
  `False`: `select`, `drop`, `rename`, `sort`, `slice`, `distinct`, `widen`)
  is refused with any tool other than its `default_tool`, and the message
  gives both fixes: the verb with its default tool
  (`identity[mod.select(…)](wf["…"])`), or the tool with `map`.

## 2. The step editor writes valid switches

- **REQ-FORM-003:** adding a shape verb from the Modifiers list replaces the
  step's shape verb, `auto` included; execution modifiers keep their places.
- **REQ-FORM-004:** choosing a verb that applies no tool also switches the
  tool to the verb's `default_tool` (from the catalog, never hard-coded), and
  drops the old tool's arguments.
- **REQ-FORM-005:** `auto` is made explicit (any edit to the modifiers) only
  with the verb resolved for the step's current tool and wiring. Until that
  answer arrives, `auto` is kept as written rather than replaced by the
  previous tool's verb.

## 3. Coverage

- **REQ-FORM-006:** for every registered tool, switching a step to it the
  way the editor does (the step before as input, `mod.auto()` unless the tool
  is a source) writes a formula that compiles, and running it either
  succeeds or fails with a message — never an internal error
  (`KeyError`, `AttributeError`, …).
- **REQ-FORM-007:** every formula in the shipped examples round-trips:
  `compile → to_parts → format_parts → compile` gives back the same operation.
