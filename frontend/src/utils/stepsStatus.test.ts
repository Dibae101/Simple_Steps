// TEST: the steps bar's status text — what the pointer is over in a step's
// grid, else what a formula bar is selecting.
import { describe, it, expect } from 'vitest';
import { compactRows, describeHover, describeSelection, stepsStatusText } from './stepsStatus';

describe('steps bar status text', () => {
  it('names what the pointer is over', () => {
    expect(describeHover({ step: 'readings', kind: 'table' })).toBe('readings · whole table');
    expect(describeHover({ step: 'readings', kind: 'column', column: 'score' })).toBe('readings · column score');
    expect(describeHover({ step: 'readings', kind: 'row', row: 3 })).toBe('readings · row 3');
    expect(describeHover({ step: 'readings', kind: 'cell', row: 3, column: 'score', value: '4.2' }))
      .toBe('readings · row 3, score = 4.2');
    expect(describeHover({ step: 'readings', kind: 'cell', row: 3, column: 'score' }))
      .toBe('readings · row 3, score');
  });

  it('keeps a long cell value to one short line', () => {
    const text = describeHover({ step: 's', kind: 'cell', row: 0, column: 'c', value: `a\n${'x'.repeat(80)}` });
    expect(text).not.toContain('\n');
    expect(text.endsWith('…')).toBe(true);
    expect(text.length).toBeLessThan(60);
  });

  it('describes a selection being made', () => {
    expect(describeSelection({ step: 'readings', kind: 'columns', columns: ['score', 'n'], rows: [] }))
      .toBe('Selecting wf["readings"] · columns score, n');
    expect(describeSelection({ step: 'readings', kind: 'rows', columns: [], rows: [3, 1, 2, 7] }))
      .toBe('Selecting wf["readings"] · rows 1–3, 7');
    expect(describeSelection({ step: 'readings', kind: 'all', columns: [], rows: [] }))
      .toBe('Selecting wf["readings"] · whole table');
  });

  it('prefers the hover, then the selection, else shows nothing', () => {
    const sel = { step: 'r', kind: 'all' as const, columns: [], rows: [] };
    expect(stepsStatusText({ step: 'r', kind: 'row', row: 1 }, sel)).toBe('r · row 1');
    expect(stepsStatusText(null, sel)).toBe('Selecting wf["r"] · whole table');
    expect(stepsStatusText(null, null)).toBe('');
  });

  it('compacts runs of rows', () => {
    expect(compactRows([5, 1, 2, 3, 3, 9, 10])).toBe('1–3, 5, 9–10');
  });
});
