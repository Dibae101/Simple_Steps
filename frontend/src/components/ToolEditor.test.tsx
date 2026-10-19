/**
 * TEST-RUN-05 (REQ-RUN-005), spec 009: the verb `mod.auto()` resolves to is
 * asked again when the input step's output changes, including its first run.
 * Core infers some reducers as `map` before their input has run and
 * `collapse` after (core-proposals/009, decision 6).
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { Step } from '../types/models';

const PARTS = {
  tool: 'reduce', bound_to: null, modifiers: [{ kind: 'auto', params: {} }],
  input: 'r', resources: [], arguments: {}, inputs: [],
};

const inferVerb = vi.fn(async (_parts: unknown, inputRef?: string) => (inputRef
  ? { verb: 'collapse', why: "'total' is not a column but 'n' is", used_data: true }
  : { verb: 'map', why: 'applying it per row', used_data: false }));

vi.mock('../utils/formulaParser', () => ({
  parseFormula: vi.fn(async () => ({ isValid: true, operationId: 'reduce', args: {}, parts: PARTS })),
  formatFormula: vi.fn(),
  inferVerb: (...args: Parameters<typeof inferVerb>) => inferVerb(...args),
}));
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  getModifiers: vi.fn(async () => ({})),
  fetchLoadedResources: vi.fn(async () => ({})),
  fetchResourceTypes: vi.fn(async () => ({})),
}));

import ToolEditor from './ToolEditor';

const input = (outputRefId?: string): Step => ({
  id: 'r', sequence_index: 0, label: 'r', formula: '=load[mod.source()]()',
  process_type: 'load', configuration: {}, status: outputRefId ? 'completed' : 'pending',
  outputRefId,
});

const editor = (previous: Step) => (
  <ToolEditor formula='=reduce[mod.auto()](wf["r"])' availableOperations={[]}
              previousSteps={[previous]} onChange={vi.fn()} />
);

describe('TEST-RUN-05 · the suggested verb follows the input (REQ-RUN-005)', () => {
  it('asks core again when the input runs, and shows the new verb', async () => {
    const { rerender } = render(editor(input()));
    await waitFor(() => expect(inferVerb).toHaveBeenCalledWith(PARTS, undefined, {}));
    expect(await screen.findByText(/auto → map/)).toBeTruthy();

    rerender(editor(input('ref-1')));                 // the input ran
    await waitFor(() => expect(inferVerb).toHaveBeenLastCalledWith(PARTS, 'ref-1', {}));
    expect(await screen.findByText(/auto → collapse/)).toBeTruthy();

    rerender(editor(input('ref-2')));                 // and ran again
    await waitFor(() => expect(inferVerb).toHaveBeenLastCalledWith(PARTS, 'ref-2', {}));
  });
});
