/**
 * Selecting data in a grid to look at it (spec 014 §6), as in Excel: a cell,
 * a row, a column, the whole table, a block, or scattered picks. Separate from
 * utils/selection.ts, which turns picks into a *formula* while one is being
 * edited; this one never writes anything.
 *
 * A selection is a set of data cells ("row:column" keys) plus the column
 * headers it includes (a column or the whole table). Rows are the grid's row
 * positions, in the order the grid shows them.
 */

import { compactRows } from './stepsStatus';

/**
 * The row-number column (the index), as a column of the selection: the
 * corner's lower-right triangle selects it (spec 014 REQ-VIS-057). Its header
 * is the corner. Never a data column's name.
 */
export const INDEX_COL = '\u0000index';

export type GridSelKind = 'cell' | 'block' | 'rows' | 'columns' | 'all' | 'cells' | 'index';

export interface GridSel {
  kind: GridSelKind;
  /** "row:column" keys of the selected data cells. */
  cells: string[];
  /** Columns whose header is part of the selection. */
  headers: string[];
  /** Where Shift extends from. */
  anchor: { row: number; col: string } | null;
}

/** What a click asks for. */
export type GridSelPick =
  | { kind: 'cell'; row: number; col: string }
  | { kind: 'row'; row: number }
  | { kind: 'column'; col: string }
  | { kind: 'index' }
  | { kind: 'all' };

export interface PickModifiers {
  /** Shift: extend from the anchor to here. */
  extend: boolean;
  /** ⌘/Ctrl: add this to the selection, or take it out. */
  toggle: boolean;
}

export const cellKey = (row: number, col: string) => `${row}:${col}`;

/** Everything from *a* to *b* in *order*, inclusive. */
function span<T>(order: T[], a: T, b: T): T[] {
  const i = order.indexOf(a);
  const j = order.indexOf(b);
  if (i < 0 || j < 0) return [b];
  return order.slice(Math.min(i, j), Math.max(i, j) + 1);
}

function cellsOf(rowList: number[], colList: string[]): string[] {
  return rowList.flatMap((r) => colList.map((c) => cellKey(r, c)));
}

/** The selection a pick makes on its own. */
function single(pick: GridSelPick, rows: number[], cols: string[]): GridSel {
  switch (pick.kind) {
    case 'cell':
      return { kind: 'cell', cells: [cellKey(pick.row, pick.col)], headers: [], anchor: { row: pick.row, col: pick.col } };
    case 'row':
      return { kind: 'rows', cells: cellsOf([pick.row], cols), headers: [], anchor: { row: pick.row, col: cols[0] } };
    case 'column':
      return { kind: 'columns', cells: cellsOf(rows, [pick.col]), headers: [pick.col], anchor: { row: rows[0], col: pick.col } };
    case 'index':
      return { kind: 'index', cells: cellsOf(rows, [INDEX_COL]), headers: [INDEX_COL], anchor: null };
    case 'all':
      return { kind: 'all', cells: cellsOf(rows, cols), headers: [...cols], anchor: null };
  }
}

/** Shift: a block from the anchor to the pick. */
function extended(prev: GridSel, pick: GridSelPick, rows: number[], cols: string[]): GridSel {
  const a = prev.anchor!;
  if (pick.kind === 'row') {
    const rowList = span(rows, a.row, pick.row);
    return { kind: 'rows', cells: cellsOf(rowList, cols), headers: [], anchor: a };
  }
  if (pick.kind === 'column') {
    const colList = span(cols, a.col, pick.col);
    return { kind: 'columns', cells: cellsOf(rows, colList), headers: colList, anchor: a };
  }
  if (pick.kind === 'cell') {
    const rowList = span(rows, a.row, pick.row);
    const colList = span(cols, a.col, pick.col);
    const kind = rowList.length === 1 && colList.length === 1 ? 'cell' : 'block';
    return { kind, cells: cellsOf(rowList, colList), headers: [], anchor: a };
  }
  return single(pick, rows, cols);
}

/** ⌘/Ctrl: add the pick, or take it out when it is already all selected. */
function toggled(prev: GridSel, pick: GridSelPick, rows: number[], cols: string[]): GridSel {
  const add = single(pick, rows, cols);
  const have = new Set(prev.cells);
  const allIn = add.cells.every((k) => have.has(k));
  const cells = allIn ? prev.cells.filter((k) => !add.cells.includes(k)) : [...prev.cells, ...add.cells.filter((k) => !have.has(k))];
  const headers = allIn
    ? prev.headers.filter((h) => !add.headers.includes(h))
    : [...prev.headers, ...add.headers.filter((h) => !prev.headers.includes(h))];
  const sameKind = (prev.kind === 'rows' && add.kind === 'rows') || (prev.kind === 'columns' && add.kind === 'columns');
  return { kind: sameKind ? prev.kind : 'cells', cells, headers, anchor: add.anchor ?? prev.anchor };
}

/**
 * Apply a click. A plain click replaces the selection; Shift extends it from
 * its anchor into a block (or a run of rows or columns); ⌘/Ctrl adds or
 * removes. Returns null when nothing is left selected.
 */
export function applyGridPick(
  prev: GridSel | null, pick: GridSelPick, mods: PickModifiers, rows: number[], cols: string[],
): GridSel | null {
  let next: GridSel;
  if (prev && mods.extend && prev.anchor && pick.kind !== 'all' && pick.kind !== 'index') next = extended(prev, pick, rows, cols);
  else if (prev && mods.toggle && pick.kind !== 'all') next = toggled(prev, pick, rows, cols);
  else next = single(pick, rows, cols);
  return next.cells.length || next.headers.length ? next : null;
}

/** Whether a data cell (row ≥ 0) or a header (row = -1) is in the selection. */
export function inGridSel(sel: GridSel | null, row: number, col: string): boolean {
  if (!sel) return false;
  return row === -1 ? sel.headers.includes(col) : sel.cells.includes(cellKey(row, col));
}

/**
 * Which sides of a cell lie on the selection's outline, so the selection is
 * drawn as one box round its edge rather than a box per cell. The header row
 * is row -1, just above the first row; the index (INDEX_COL) is the column
 * left of the first.
 */
export function selectionEdges(sel: GridSel | null, row: number, col: string, rows: number[], dataCols: string[]) {
  const none = { top: false, right: false, bottom: false, left: false };
  // A whole row's box takes in its row number, as a column's takes in its header.
  const has = (r: number, c: string) =>
    inGridSel(sel, r, c) || (sel?.kind === 'rows' && c === INDEX_COL && inGridSel(sel, r, dataCols[0]));
  if (!has(row, col)) return none;
  const cols = [INDEX_COL, ...dataCols];
  const i = row === -1 ? -1 : rows.indexOf(row);
  const above = i <= 0 ? -1 : rows[i - 1];          // the first row sits under the header
  const below = i === -1 ? rows[0] : rows[i + 1];
  const c = cols.indexOf(col);
  return {
    top: i === -1 || !has(above, col),
    bottom: below === undefined || !has(below, col),
    left: c === 0 || !has(row, cols[c - 1]),
    right: c === cols.length - 1 || !has(row, cols[c + 1]),
  };
}

/**
 * Where the selection's *open* control sits: its top-right corner — the
 * rightmost header for a column or whole-table pick, otherwise the rightmost
 * cell of its first row. `row` is -1 for a header.
 */
export function controlCorner(sel: GridSel | null, rows: number[], dataCols: string[]): { row: number; col: string } | null {
  if (!sel) return null;
  const cols = [INDEX_COL, ...dataCols];
  if (sel.headers.length) {
    const col = cols.filter((c) => sel.headers.includes(c)).pop();
    return col === undefined ? null : { row: -1, col };
  }
  const row = rows.find((r) => cols.some((c) => inGridSel(sel, r, c)));
  if (row === undefined) return null;
  const col = cols.filter((c) => inGridSel(sel, row, c)).pop();
  return col === undefined ? null : { row, col };
}

/**
 * Whether a selection takes whole columns (a column, the whole table, the
 * index): then it means every row of the step, not just the rows loaded.
 */
export function takesWholeColumns(sel: GridSel): boolean {
  return sel.kind === 'columns' || sel.kind === 'all' || sel.kind === 'index';
}

/**
 * The rows and data columns a selection touches, in the grid's order (what
 * the popover shows; it always shows the index beside them).
 */
export function selectionExtent(sel: GridSel, rows: number[], cols: string[]): { rows: number[]; cols: string[] } {
  return {
    rows: rows.filter((r) => [INDEX_COL, ...cols].some((c) => inGridSel(sel, r, c))),
    cols: cols.filter((c) => rows.some((r) => inGridSel(sel, r, c)) || sel.headers.includes(c)),
  };
}

/** One line for the status bar and the popover: `rows 1–2 × city–n · 2×2`. */
export function describeGridSel(sel: GridSel, rows: number[], cols: string[]): string {
  const ext = selectionExtent(sel, rows, cols);
  const colRange = ext.cols.length === 1 ? ext.cols[0] : `${ext.cols[0]}–${ext.cols[ext.cols.length - 1]}`;
  switch (sel.kind) {
    case 'cell':
      return `row ${ext.rows[0]}, ${ext.cols[0]}`;
    case 'index':
      return `row index · ${rows.length} row${rows.length === 1 ? '' : 's'}`;
    case 'all':
      return `whole table · ${rows.length} row${rows.length === 1 ? '' : 's'} × ${cols.length} column${cols.length === 1 ? '' : 's'}`;
    case 'rows':
      return `${ext.rows.length === 1 ? 'row' : 'rows'} ${compactRows(ext.rows)}`;
    case 'columns':
      return `${ext.cols.length === 1 ? 'column' : 'columns'} ${ext.cols.join(', ')} · ${rows.length} row${rows.length === 1 ? '' : 's'}`;
    case 'block':
      return `rows ${compactRows(ext.rows)} × ${colRange} · ${ext.rows.length}×${ext.cols.length}`;
    case 'cells':
      return `${sel.cells.length} cell${sel.cells.length === 1 ? '' : 's'}`;
  }
}
