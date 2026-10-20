/**
 * Spec 012: what the step editor writes when a step's tool or verb is
 * switched. TEST-FORM-03c covers REQ-FORM-003 (one shape verb), TEST-FORM-04c
 * REQ-FORM-004 (a verb that applies no tool brings its own), TEST-FORM-05b
 * REQ-FORM-005 (auto is never made explicit with the previous tool's verb),
 * and TEST-FORM-06b the Tool list switch back from such a verb.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormulaParts } from '../utils/formulaParser';
import type { OperationDefinition } from '../services/api';
import type { Step } from '../types/models';

/** The parts each formula parses to — what the backend's parse_formula returns. */
const PARSED: Record<string, FormulaParts> = {};
const parts = (tool: string, modifiers: FormulaParts['modifiers'], extra: Partial<FormulaParts> = {}): FormulaParts => ({
  tool, bound_to: null, modifiers, input: 'r', resources: [], arguments: {}, inputs: [], ...extra,
});
PARSED['=scale[mod.map()](wf["r"], weight=2)'] = parts('scale', [{ kind: 'map', params: {} }], { arguments: { weight: 2 } });
PARSED['=reduce[mod.auto()](wf["r"])'] = parts('reduce', [{ kind: 'auto', params: {} }]);
PARSED['=scale[mod.auto()](wf["r"])'] = parts('scale', [{ kind: 'auto', params: {} }]);
PARSED['=identity[mod.select(columns=["n"])](wf["r"])'] = parts('identity', [{ kind: 'select', params: { columns: ['n'] } }]);

/** Core answers for reduce at once; for scale, only when a test lets it. */
let releaseScale: (() => void) | null = null;
const inferVerb = vi.fn((p: FormulaParts) => (p.tool === 'reduce'
  ? Promise.resolve({ verb: 'collapse', why: 'reduces', used_data: false })
  : new Promise((resolve) => { releaseScale = () => resolve({ verb: 'map', why: 'per row', used_data: false }); })));

const formatFormula = vi.fn(async (p: FormulaParts) => ({
  formula: `${p.tool}[…]`, parsed: { isValid: true, operationId: p.tool, args: {}, parts: p },
}));

vi.mock('../utils/formulaParser', () => ({
  parseFormula: vi.fn(async (f: string) => ({ isValid: true, operationId: PARSED[f]?.tool, args: {}, parts: PARSED[f] })),
  formatFormula: (p: FormulaParts) => formatFormula(p),
  inferVerb: (p: FormulaParts) => inferVerb(p),
}));

/** Core's catalog, as /api/modifiers serves it (the fields the editor reads). */
const shape = (name: string, takes_tool: boolean | 'optional', default_tool: string | null = null) =>
  ({ name, class: 'shape', row_rule: null, settings: [], takes_tool, default_tool });
const CATALOG = {
  map: shape('map', true), filter: shape('filter', true), auto: shape('auto', true),
  select: shape('select', false, 'identity'), sort: shape('sort', false, 'identity'),
  retry: { name: 'retry', class: 'execution', row_rule: null, settings: [], takes_tool: null, default_tool: null },
};
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  getModifiers: vi.fn(async () => CATALOG),
  fetchLoadedResources: vi.fn(async () => ({})),
  fetchResourceTypes: vi.fn(async () => ({})),
}));

import ToolEditor from './ToolEditor';

const TOOLS: OperationDefinition[] = [
  { id: 'scale', label: 'scale', description: '', type: 'map', category: 'Basic', params: [] },
  { id: 'reduce', label: 'reduce', description: '', type: 'map', category: 'Basic', params: [] },
];
const r: Step = {
  id: 'r', sequence_index: 0, label: 'r', formula: '=load[mod.source()]()',
  process_type: 'load', configuration: {}, status: 'pending',
};
const editor = (formula: string) => (
  <ToolEditor formula={formula} availableOperations={TOOLS} previousSteps={[r]} onChange={vi.fn()} />
);

/** Choose *value* in the "+ Add modifier…" list, once the catalog has loaded. */
async function addModifier(value: string) {
  await screen.findByRole('option', { name: value });
  fireEvent.change(document.querySelector('select.te-add')!, { target: { value } });
}
const lastWritten = () => formatFormula.mock.calls.at(-1)![0];

beforeEach(() => {
  formatFormula.mockClear();
  releaseScale = null;
});

describe('spec 012 · switching a step in the editor', () => {
  it('TEST-FORM-03c: adding a shape verb replaces the step\'s verb (REQ-FORM-003)', async () => {
    render(editor('=scale[mod.map()](wf["r"], weight=2)'));
    await addModifier('filter');
    await waitFor(() => expect(formatFormula).toHaveBeenCalled());
    expect(lastWritten()).toMatchObject({ tool: 'scale', modifiers: [{ kind: 'filter', params: {} }], arguments: { weight: 2 } });
  });

  it('TEST-FORM-04c: choosing select switches the tool to identity (REQ-FORM-004)', async () => {
    render(editor('=scale[mod.map()](wf["r"], weight=2)'));
    await addModifier('select');
    await waitFor(() => expect(formatFormula).toHaveBeenCalled());
    expect(lastWritten()).toMatchObject({ tool: 'identity', arguments: {}, input: 'r', modifiers: [{ kind: 'select', params: {} }] });
  });

  it('TEST-FORM-05b: right after a tool switch, auto is kept rather than given the old tool\'s verb (REQ-FORM-005)', async () => {
    const { rerender } = render(editor('=reduce[mod.auto()](wf["r"])'));
    expect(await screen.findByText(/auto → collapse/)).toBeTruthy();   // reduce: collapse

    rerender(editor('=scale[mod.auto()](wf["r"])'));                    // switched; core hasn't answered
    await waitFor(() => expect(inferVerb).toHaveBeenLastCalledWith(expect.objectContaining({ tool: 'scale' })));
    await addModifier('retry');
    await waitFor(() => expect(formatFormula).toHaveBeenCalled());
    expect(lastWritten().modifiers).toEqual([{ kind: 'auto', params: {} }, { kind: 'retry', params: {} }]);

    releaseScale!();                                                    // core answers for scale
    expect(await screen.findByText(/auto → map/)).toBeTruthy();
    formatFormula.mockClear();
    await addModifier('retry');                                         // now auto becomes scale's verb
    await waitFor(() => expect(formatFormula).toHaveBeenCalled());
    expect(lastWritten().modifiers![0]).toEqual({ kind: 'map', params: {} });
    expect(lastWritten().modifiers!.some((m) => m.kind === 'auto' || m.kind === 'collapse')).toBe(false);
  });

  it('TEST-FORM-06b: switching from a select step to a tool reads the same step, verb auto', async () => {
    render(editor('=identity[mod.select(columns=["n"])](wf["r"])'));
    await screen.findByRole('option', { name: 'scale' });
    fireEvent.change(document.querySelector('select.te-tool-select')!, { target: { value: 'scale' } });
    await waitFor(() => expect(formatFormula).toHaveBeenCalled());
    expect(lastWritten()).toMatchObject({ tool: 'scale', input: 'r', arguments: {}, modifiers: [{ kind: 'auto', params: {} }] });
  });
});
