import { describe, expect, it } from 'vitest';
import {
  applyGridPick, controlCorner, describeGridSel, inGridSel, selectionEdges, selectionExtent,
} from './gridSelection';

// Spec 014 §6: selecting data in a grid to look at it (REQ-VIS-011, REQ-VIS-012, REQ-VIS-013).
const rows = [0, 1, 2, 3];
const cols = ['city', 'n', 'value'];
const plain = { extend: false, toggle: false };
const shift = { extend: true, toggle: false };
const meta = { extend: false, toggle: true };

describe('applyGridPick (REQ-VIS-011)', () => {
  it('a click on a cell, a row number, a header or the corner selects that', () => {
    expect(applyGridPick(null, { kind: 'cell', row: 1, col: 'n' }, plain, rows, cols)!.cells).toEqual(['1:n']);
    expect(applyGridPick(null, { kind: 'row', row: 2 }, plain, rows, cols)!.cells).toEqual(['2:city', '2:n', '2:value']);
    const col = applyGridPick(null, { kind: 'column', col: 'n' }, plain, rows, cols)!;
    expect(col.cells).toEqual(['0:n', '1:n', '2:n', '3:n']);
    expect(col.headers).toEqual(['n']);
    const all = applyGridPick(null, { kind: 'all' }, plain, rows, cols)!;
    expect(all.cells).toHaveLength(12);
    expect(all.headers).toEqual(cols);
  });

  it('Shift extends from the anchor into a block, or a run of rows or columns', () => {
    const start = applyGridPick(null, { kind: 'cell', row: 1, col: 'city' }, plain, rows, cols);
    const block = applyGridPick(start, { kind: 'cell', row: 2, col: 'n' }, shift, rows, cols)!;
    expect(block.kind).toBe('block');
    expect(block.cells.sort()).toEqual(['1:city', '1:n', '2:city', '2:n']);
    const runRows = applyGridPick(applyGridPick(null, { kind: 'row', row: 0 }, plain, rows, cols),
      { kind: 'row', row: 2 }, shift, rows, cols)!;
    expect(runRows.kind).toBe('rows');
    expect(runRows.cells).toHaveLength(9);
  });

  it('⌘/Ctrl adds a pick, and takes it out again', () => {
    const one = applyGridPick(null, { kind: 'cell', row: 0, col: 'n' }, plain, rows, cols);
    const two = applyGridPick(one, { kind: 'cell', row: 3, col: 'value' }, meta, rows, cols)!;
    expect(two.kind).toBe('cells');
    expect(two.cells).toEqual(['0:n', '3:value']);
    const back = applyGridPick(two, { kind: 'cell', row: 3, col: 'value' }, meta, rows, cols)!;
    expect(back.cells).toEqual(['0:n']);
    expect(applyGridPick(back, { kind: 'cell', row: 0, col: 'n' }, meta, rows, cols)).toBeNull();
  });
});

describe('the outline (REQ-VIS-012)', () => {
  it('a block is one box round its edge, not a box per cell', () => {
    const sel = applyGridPick(applyGridPick(null, { kind: 'cell', row: 1, col: 'city' }, plain, rows, cols),
      { kind: 'cell', row: 2, col: 'n' }, shift, rows, cols);
    expect(selectionEdges(sel, 1, 'city', rows, cols)).toEqual({ top: true, right: false, bottom: false, left: true });
    expect(selectionEdges(sel, 2, 'n', rows, cols)).toEqual({ top: false, right: true, bottom: true, left: false });
    expect(selectionEdges(sel, 0, 'city', rows, cols)).toEqual({ top: false, right: false, bottom: false, left: false });
  });

  it("a column's box runs from its header to its last row", () => {
    const sel = applyGridPick(null, { kind: 'column', col: 'n' }, plain, rows, cols);
    expect(inGridSel(sel, -1, 'n')).toBe(true);
    expect(selectionEdges(sel, -1, 'n', rows, cols).top).toBe(true);
    expect(selectionEdges(sel, 0, 'n', rows, cols).top).toBe(false);
    expect(selectionEdges(sel, 3, 'n', rows, cols).bottom).toBe(true);
  });

  it('the open control sits at the top-right corner of the selection', () => {
    expect(controlCorner(applyGridPick(null, { kind: 'row', row: 2 }, plain, rows, cols), rows, cols))
      .toEqual({ row: 2, col: 'value' });
    expect(controlCorner(applyGridPick(null, { kind: 'all' }, plain, rows, cols), rows, cols))
      .toEqual({ row: -1, col: 'value' });
  });
});

describe('what the selection covers (REQ-VIS-013)', () => {
  it('describes itself in one line', () => {
    const block = applyGridPick(applyGridPick(null, { kind: 'cell', row: 1, col: 'city' }, plain, rows, cols),
      { kind: 'cell', row: 2, col: 'n' }, shift, rows, cols)!;
    expect(describeGridSel(block, rows, cols)).toBe('rows 1–2 × city–n · 2×2');
    expect(describeGridSel(applyGridPick(null, { kind: 'all' }, plain, rows, cols)!, rows, cols))
      .toBe('whole table · 4 rows × 3 columns');
    expect(describeGridSel(applyGridPick(null, { kind: 'cell', row: 0, col: 'n' }, plain, rows, cols)!, rows, cols))
      .toBe('row 0, n');
  });

  it('its extent is the rows and columns it touches, in grid order', () => {
    const sel = applyGridPick(applyGridPick(null, { kind: 'cell', row: 3, col: 'value' }, plain, rows, cols),
      { kind: 'cell', row: 0, col: 'city' }, meta, rows, cols)!;
    expect(selectionExtent(sel, rows, cols)).toEqual({ rows: [0, 3], cols: ['city', 'value'] });
  });
});
