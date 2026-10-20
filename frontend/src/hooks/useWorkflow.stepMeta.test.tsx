/**
 * TEST: a step's colour and notes (set in its Settings) are saved in the step's
 * `meta` and come back on load. The formula can't carry them, so `meta` — kept
 * as-is by the backend's StepConfig — is where they live.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PipelineFile } from '../services/api';

const api = vi.hoisted(() => ({
  savePipeline: vi.fn(async (_p: string, pipeline: unknown) => pipeline),
  loadPipeline: vi.fn(),
}));
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  getOperations: vi.fn(async () => []),
  savePipeline: api.savePipeline,
  loadPipeline: api.loadPipeline,
}));
vi.mock('../utils/formulaParser', () => ({
  parseFormula: vi.fn(async () => ({ isValid: false, operationId: null, args: {} })),
  buildFormula: vi.fn(async () => ''),
}));

import useWorkflow from './useWorkflow';

describe('useWorkflow: step colour and notes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves step_color and notes in the step meta', async () => {
    const { result } = renderHook(() => useWorkflow());
    const id = result.current.workflow.steps[0].id;
    act(() => result.current.updateStep(id, { step_color: '#22aa88', notes: '**Why** this step' }));
    await act(async () => { await result.current.saveWorkflow('p', 'flow'); });

    const saved = api.savePipeline.mock.calls[0][1] as PipelineFile;
    expect(saved.steps[0].meta).toEqual({ step_color: '#22aa88', notes: '**Why** this step' });
  });

  it('leaves meta out for a step with neither', async () => {
    const { result } = renderHook(() => useWorkflow());
    await act(async () => { await result.current.saveWorkflow('p', 'flow'); });
    const saved = api.savePipeline.mock.calls[0][1] as PipelineFile;
    expect(saved.steps[0].meta).toBeUndefined();
  });

  it('restores step_color and notes from the step meta on load', async () => {
    api.loadPipeline.mockResolvedValue({
      id: 'flow', name: 'Flow', created_at: '', updated_at: '',
      steps: [{
        step_id: 'load', operation_id: 'noop', label: 'Load', config: {}, formula: '',
        meta: { step_color: '#123456', notes: 'Loads the raw rows.', label: 'Load' },
      }],
    });
    const { result } = renderHook(() => useWorkflow());
    const wf = await act(async () => result.current.fetchWorkflow('p', 'flow'));
    expect(wf.steps[0].step_color).toBe('#123456');
    expect(wf.steps[0].notes).toBe('Loads the raw rows.');
  });
});
