/**
 * TEST-RUN-02 (REQ-RUN-002) and TEST-RUN-04 (REQ-RUN-004), spec 009:
 * core's warnings reach the step and the log, and Run All stops at a step
 * whose rows failed without mod.try_except.
 *
 * The backend is mocked: each step's formula names the metrics its run returns.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Metrics = { failed?: number; uncaught_failed?: number; warnings?: string[] };

// formula → the metrics /api/run answers with
const RESULTS: Record<string, Metrics> = {
  '=ok()': {},
  '=boom()': { failed: 1, uncaught_failed: 1 },
  '=caught()': { failed: 1, uncaught_failed: 0 },
  '=warned()': { warnings: ["city='Paris' overrides the 'city' column of 'r' for every row"] },
};

const runStepApi = vi.fn(async (_id: string, _op: string, _config: unknown, _input: unknown,
                                _map: unknown, _preview: unknown, formula?: string) => ({
  status: 'success' as const,
  output_ref_id: `ref-${formula}-${Math.random()}`,
  metrics: { rows: 1, columns: ['value'], engine: 'grid' as const, units: 3, ...RESULTS[formula ?? ''] },
}));

vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  getOperations: vi.fn(async () => []),
  runStep: (...args: Parameters<typeof runStepApi>) => runStepApi(...args),
  fetchDataMeta: vi.fn(async () => ({ rows: 1, columns: ['value'] })),
  fetchDataView: vi.fn(async () => []),
  listenProgress: vi.fn(() => () => {}),
}));
vi.mock('../utils/formulaParser', () => ({
  parseFormula: vi.fn(async (formula: string) => ({
    isValid: true, operationId: formula.replace(/^=|\(\)$/g, ''), args: {},
  })),
  buildFormula: vi.fn(async () => ''),
}));

import useWorkflow from './useWorkflow';

/** A workflow of these formulas, in order, replacing the initial step. */
async function workflowOf(formulas: string[]) {
  const hook = renderHook(() => useWorkflow());
  await act(async () => {
    hook.result.current.loadWorkflowObject({
      id: 'wf-test', name: 'test', created_at: '',
      steps: formulas.map((formula, i) => ({
        id: `s${i}`, sequence_index: i, label: `s${i}`, formula,
        process_type: '', configuration: {}, status: 'pending' as const,
      })),
    });
  });
  return hook;
}

const ran = () => runStepApi.mock.calls.map((call) => call[6]);

beforeEach(() => runStepApi.mockClear());

describe('TEST-RUN-04 · Run All stops on an uncaught failure (REQ-RUN-004)', () => {
  it('stops after a step whose rows failed, and says how to let them through', async () => {
    const { result } = await workflowOf(['=ok()', '=boom()', '=ok()']);
    await act(async () => { result.current.runPipeline(); });
    await waitFor(() => expect(result.current.pipelineStatus).toBe('idle'), { timeout: 5000 });

    expect(ran()).toEqual(['=ok()', '=boom()']);           // the third step never ran
    const stopped = result.current.executionLogs.find((l) => l.message.startsWith('Run stopped at "s1"'));
    expect(stopped?.level).toBe('error');
    expect(stopped?.detail).toContain('Not run: s2');
    expect(stopped?.detail).toContain('mod.try_except');
    // The failed step keeps its output, so its failed cells can be inspected.
    const s1 = result.current.workflow.steps[1];
    expect(s1.status).toBe('completed');
    expect(s1.outputRefId).toBeDefined();
    expect(result.current.workflow.steps[2].status).toBe('pending');
  });

  it('carries on past failures that try_except caught', async () => {
    const { result } = await workflowOf(['=ok()', '=caught()', '=ok()']);
    await act(async () => { result.current.runPipeline(); });
    await waitFor(() => expect(result.current.pipelineStatus).toBe('idle'), { timeout: 5000 });

    expect(ran()).toEqual(['=ok()', '=caught()', '=ok()']);
    expect(result.current.executionLogs.some((l) => l.message.startsWith('Run stopped'))).toBe(false);
  });
});

describe('TEST-RUN-02 · core warnings reach the user (REQ-RUN-002)', () => {
  it('logs the warnings and keeps them on the step', async () => {
    const { result } = await workflowOf(['=warned()']);
    await act(async () => { await result.current.runStep('s0'); });

    expect(result.current.workflow.steps[0].warnings).toEqual(RESULTS['=warned()'].warnings);
    const logged = result.current.executionLogs.find((l) => l.level === 'warn' && l.stepId === 's0');
    expect(logged?.message).toBe('Step "s0": a warning from core');
    expect(logged?.detail).toContain("overrides the 'city' column");
  });

  it('a later run without warnings clears them', async () => {
    const { result } = await workflowOf(['=warned()']);
    await act(async () => { await result.current.runStep('s0'); });
    await act(async () => { result.current.updateStep('s0', { formula: '=ok()' }); });
    await act(async () => { await result.current.runStep('s0'); });

    expect(result.current.workflow.steps[0].warnings).toEqual([]);
  });
});
