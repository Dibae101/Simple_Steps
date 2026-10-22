import { useEffect, useMemo, useRef, useState } from 'react';
import { isErrorCell } from '../utils/errorCells';
import type { GridPick, Selection } from '../utils/selection';
import {
  INDEX_COL, applyGridPick, controlCorner, describeGridSel, inGridSel, selectionEdges, selectionExtent,
  takesWholeColumns,
} from '../utils/gridSelection';
import type { GridSel, GridSelPick } from '../utils/gridSelection';
import type { GridSpot } from '../utils/stepsStatus';
import type { Cell } from '../types/models';
import type { StagedColumn } from '../hooks/useStagedPreview';
import Icon from './Icon';
import SelectionPopover from './SelectionPopover';
import './OperationColumn.css'; // Ensure grid styles are available
import './CellViewer.css';

/** The selection's outline (spec 014 REQ-VIS-012): neutral, never a step colour. */
const SELECTION_EDGE = '#1f2937';
/** The active cell's row number and column header. */
const ACTIVE_HEADER_BG = '#e2e5ea';

interface OpenPopover {
  id: number;
  at: { x: number; y: number };
  sel: GridSel;
}

const TYPE_ICONS: Record<string, string> = { plotly: '📈', table: '▦', json: '{}' };

/**
 * What a cell shows. Text and numbers as they are; a typed value (an image, a
 * figure, a table, a dict — backend cell_types.py) as its preview or an icon,
 * plus its summary. The full value opens in the selection popover.
 */
function CellContent({ cell }: { cell: Cell }) {
  if (!cell.cell_type) return <>{cell.display_value}</>;
  const summary = cell.summary ?? cell.display_value;
  return (
    <span className="typed-cell" data-cell-type={cell.cell_type}>
      {cell.preview
        ? <img className="typed-cell-thumb" src={cell.preview} alt="" />
        : TYPE_ICONS[cell.cell_type] && <span className="typed-cell-icon">{TYPE_ICONS[cell.cell_type]}</span>}
      <span className="typed-cell-text">{summary}</span>
    </span>
  );
}

/** The column of the 1×1 frame shown for a step with no output yet — core's
 *  default output column name. */
export const EMPTY_FRAME_COLUMN = 'value';
const EMPTY_FRAME_CELL: Cell = {
  row_id: 0, column_id: EMPTY_FRAME_COLUMN, value: null, display_value: 'empty',
  metadata: { empty: true },
};
const isEmptyFrameCell = (cell?: Cell) => cell?.metadata?.empty === true;

interface DataOutputGridProps {
  cells?: Cell[];
  onCellClick?: (cell: Cell) => void;
  wiringMode?: boolean;
  /** In wiring mode: a click on the whole table, a column header or a row number. */
  onPick?: (pick: GridPick) => void;
  /** What the step being edited currently selects from this grid. */
  highlight?: Selection | null;
  /** Staged columns to render as light-yellow pending cells alongside real data */
  stagedColumns?: StagedColumn[];
  /** Visual mode for staged cells when pipeline is queued/running */
  stagedCellMode?: 'idle' | 'scheduled' | 'running';
  /** The output these cells come from; lets a typed cell open its full view. */
  refId?: string;
  /**
   * What the pointer is over — the table corner, a column, a row, a cell — or
   * null when it leaves the grid. In every mode, not just wiring; the steps
   * bar shows it (context/StepsStatusContext).
   */
  onHoverChange?: (spot: GridSpot | null) => void;
  /**
   * The data's size and the selection in one line (`3 rows, 2 columns · row 1`),
   * whenever it changes — shown on the Data bar, not under the grid.
   */
  onNoteChange?: (note: string) => void;
  /** The step's name, colour and formula, for the selection popover's header. */
  stepName?: string;
  stepColor?: string;
  formula?: string;
}

export default function DataOutputGrid({
  cells = [],
  onCellClick,
  wiringMode = false,
  onPick,
  highlight = null,
  stagedColumns = [],
  stagedCellMode = 'idle',
  refId,
  onHoverChange,
  onNoteChange,
  stepName = 'step',
  stepColor,
  formula,
}: DataOutputGridProps) {
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);
  // Looking at data (spec 014 §6, §8): a click selects — a cell, a row, a
  // column, the whole table, a block — and draws its outline only. Hovering
  // the selection shows an open control on its border, which opens the
  // selection popover. Picking for a formula (wiring mode) is separate.
  // The selection remembers the cells it was made on: new data (a re-run, a
  // new page) means the old selection may not exist any more, so it lapses.
  // Open popovers keep the copy they were opened with.
  const [selection, setSelection] = useState<{ sel: GridSel | null; of: Cell[] | undefined }>({ sel: null, of: cells });
  const [overSelection, setOverSelection] = useState(false);
  const [popovers, setPopovers] = useState<OpenPopover[]>([]);
  const nextPopover = useRef(1);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  // Cells aren't pickable yet (they need rows AND columns, core 005 K9), so
  // only the setter is used — kept for when they are.
  const [, setHoveredCell] = useState<string | null>(null);

  // Memoize grid structure calculation
  const { cols, rows, gridData, structureType, stagedColNames, stagedData } = useMemo(() => {
    const safeCells = cells ?? [];

    // Build staged lookup: "rowIndex:colName" -> staged metadata
    const sColNames: string[] = [];
    const sData: Record<string, { formula: string; state: string }> = {};
    for (const sc of stagedColumns) {
      if (!sColNames.includes(sc.name)) sColNames.push(sc.name);
      for (const cell of sc.cells) {
        sData[`${cell.rowIndex}:${sc.name}`] = {
          formula: cell.formula,
          state: cell.state,
        };
      }
    }

    if (safeCells.length === 0 && sColNames.length === 0) {
      // A step's Data is always a dataframe. With nothing in it yet — an empty
      // or undefined expression, or a step not run — it is a 1×1 frame whose
      // one cell says "empty", drawn by the same grid as any other output.
      return {
        cols: [EMPTY_FRAME_COLUMN], rows: [0], gridData: { [`0:${EMPTY_FRAME_COLUMN}`]: EMPTY_FRAME_CELL },
        structureType: 'grid', stagedColNames: [], stagedData: {},
      };
    }

    const uniqueCols = Array.from(new Set(safeCells.map((c) => c.column_id)));
    const uniqueRows = Array.from(new Set(safeCells.map((c) => c.row_id))).sort(
      (a, b) => a - b
    );

    // Merge staged column names (only add ones not already in real data)
    const allCols = [...uniqueCols];
    for (const sc of sColNames) {
      if (!allCols.includes(sc)) allCols.push(sc);
    }

    // If we have staged columns but no real rows, generate row indices from staged data
    let allRows = uniqueRows;
    if (allRows.length === 0 && sColNames.length > 0 && stagedColumns[0]?.cells.length > 0) {
      allRows = Array.from({ length: stagedColumns[0].cells.length }, (_, i) => i);
    }

    // Create a lookup map for faster access: "rowId:colId" -> Cell
    const dataMap: Record<string, Cell> = {};
    safeCells.forEach((c) => {
      dataMap[`${c.row_id}:${c.column_id}`] = c;
    });

    // Determine visualization type — always use grid for tabular consistency
    const type = 'grid';

    return {
      cols: allCols,
      rows: allRows,
      gridData: dataMap,
      structureType: type,
      stagedColNames: sColNames,
      stagedData: sData,
    };
  }, [cells, stagedColumns]);

  // ── Looking: selection and the popover ──────────────────────────────────
  const looking = !wiringMode;
  const shownSel = looking && selection.of === cells ? selection.sel : null;
  const select = (pick: GridSelPick, e: React.MouseEvent) => {
    const mods = { extend: e.shiftKey, toggle: e.metaKey || e.ctrlKey };
    setSelection((prev) => ({ sel: applyGridPick(prev.of === cells ? prev.sel : null, pick, mods, rows, cols), of: cells }));
  };
  const corner = controlCorner(shownSel, rows, cols);
  const isCorner = (row: number, col: string) => !!corner && corner.row === row && corner.col === col;
  const activeCell = shownSel?.kind === 'cell' ? shownSel.anchor : null;

  /** The outline drawn on one cell or header, as inset shadows. */
  const outline = (row: number, col: string): React.CSSProperties => {
    const e = selectionEdges(shownSel, row, col, rows, cols);
    const sides = [
      e.top && `inset 0 2px 0 ${SELECTION_EDGE}`,
      e.bottom && `inset 0 -2px 0 ${SELECTION_EDGE}`,
      e.left && `inset 2px 0 0 ${SELECTION_EDGE}`,
      e.right && `inset -2px 0 0 ${SELECTION_EDGE}`,
    ].filter(Boolean);
    return {
      ...(sides.length ? { boxShadow: sides.join(', ') } : {}),
      ...(isCorner(row, col) ? { position: 'relative' as const } : {}),
    };
  };

  const openPopover = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!shownSel) return;
    const id = nextPopover.current++;
    setPopovers((ps) => [...ps, { id, at: { x: e.clientX, y: e.clientY }, sel: shownSel }]);
  };

  /** The open control, at the selection's top-right corner (REQ-VIS-040). */
  const openControl = (row: number, col: string) => isCorner(row, col) && (
    <button
      type="button"
      className={`sel-open${overSelection ? ' sel-open-shown' : ''}`}
      aria-label="Open the selection"
      title="Open the selection"
      onClick={openPopover}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Icon name="screen-full" size={11} aria-hidden aria-label={undefined} />
    </button>
  );

  // ── Wiring: picks ───────────────────────────────────────────────────────
  // A click while a later step's formula bar has focus picks data for it:
  // the # corner the whole table, a header a column, a row number a row.
  // Shift extends from the last pick; ⌘/Ctrl toggles one more. The receiving
  // step turns the pick into a select operation (utils/selection.ts).
  // Cells and blocks (rows AND columns) come later — core 005 K9.

  const modifiers = (e: React.MouseEvent) => ({ extend: e.shiftKey, toggle: e.metaKey || e.ctrlKey });

  const handleRowClick = (rowIndex: number, e: React.MouseEvent) => {
    if (wiringMode && onPick) onPick({ kind: 'row', row: rowIndex, order: rows, ...modifiers(e) });
    else select({ kind: 'row', row: rowIndex }, e);
  };

  const handleColumnClick = (col: string, e: React.MouseEvent) => {
    if (wiringMode && onPick) {
      onPick({ kind: 'column', column: col, order: cols, ...modifiers(e) });
      return;
    }
    select({ kind: 'column', col }, e);
    onCellClick?.({ row_id: -1, column_id: col, value: col, display_value: col } as Cell);
  };

  const handleCellWireClick = (cell: Cell, e: React.MouseEvent) => {
    if (wiringMode) return;            // single cells: later (needs rows AND columns)
    select({ kind: 'cell', row: cell.row_id, col: cell.column_id }, e);
    onCellClick?.(cell);
  };

  const handleCornerClick = (e: React.MouseEvent) => {
    if (wiringMode && onPick) onPick({ kind: 'all' });
    else select({ kind: 'all' }, e);
  };

  /** The corner's lower triangle: the index (row numbers). Looking only — a
   *  formula can't reference the index yet. */
  const handleIndexClick = (e: React.MouseEvent) => {
    if (!wiringMode) select({ kind: 'index' }, e);
  };

  /** The pointer is over (row, col), a header when row is -1: is that in the selection? */
  const noteOver = (row: number, ...colsHere: string[]) =>
    setOverSelection(colsHere.some((col) => inGridSel(shownSel, row, col)));
  const indexSelected = inGridSel(shownSel, -1, INDEX_COL);

  const note = `${rows.length} row${rows.length !== 1 ? 's' : ''}, ${cols.length} column${cols.length !== 1 ? 's' : ''}`
    + (shownSel ? ` · ${describeGridSel(shownSel, rows, cols)}` : '');
  useEffect(() => { onNoteChange?.(note); }, [note, onNoteChange]);

  const isColumnSelected = (col: string) =>
    !!highlight && (highlight.kind === 'all' || (highlight.kind === 'columns' && highlight.columns.includes(col)));
  const isRowSelected = (row: number) =>
    !!highlight && (highlight.kind === 'all' || (highlight.kind === 'rows' && highlight.rows.includes(row)));

  // ── Wiring overlay styles ───────────────────────────────────────────────

  const SELECTED_BG = 'rgba(255, 193, 7, 0.32)';
  const HOVER_BG = 'rgba(255, 193, 7, 0.16)';

  const wiringColHeaderStyle = (col: string): React.CSSProperties => {
    if (!wiringMode) return { cursor: 'pointer', userSelect: 'none' as const };
    return {
      cursor: 'crosshair',
      userSelect: 'none',
      background: isColumnSelected(col) ? SELECTED_BG : hoveredCol === col ? HOVER_BG : undefined,
      transition: 'background 0.1s ease',
    };
  };

  const wiringCellStyle = (key: string, col: string): React.CSSProperties => {
    const row = Number(key.split(':')[0]);
    const selected = isColumnSelected(col) || isRowSelected(row);
    if (!wiringMode) return { cursor: 'pointer', ...(selected ? { background: SELECTED_BG } : {}) };
    const hovered = hoveredCol === col || hoveredRow === row || hoveredCol === '__table__';
    return {
      cursor: 'default',
      background: selected ? SELECTED_BG : hovered ? HOVER_BG : 'transparent',
      transition: 'background 0.1s ease',
    };
  };

  // ── SCENARIO 0: the step failed — its output is one error cell ─────────
  // `errorCell()` (utils/errorCells.ts) builds it when a run or preview fails,
  // including an expression that doesn't parse.
  if (cells && cells.length === 1 && isErrorCell(cells[0])) {
    return (
      <div className="output-container error">
        <div className="error-cell" role="alert" data-testid="step-error-cell">
          {cells[0].display_value}
        </div>
      </div>
    );
  }

  // ── SCENARIO 1: Single Value (Hero Cell) ───────────────────────────────

  if (structureType === 'single-value') {
    const cell = gridData[`${rows[0]}:${cols[0]}`];
    return (
      <div className="output-container single">
        <div
          className="single-value-display"
          onClick={(e) => {
            if (cell) handleCellWireClick(cell, e);
          }}
          title="Click to select"
          style={{}}
        >
          {cell ? <CellContent cell={cell} /> : ''}
        </div>
      </div>
    );
  }

  // ── SCENARIO 2 & 3: List or Grid ──────────────────────────────────────

  return (
    <div className="output-container grid-wrapper">
      {/* Wiring mode banner */}

      <div
        className={`op-data-grid${wiringMode ? ' wiring-source' : ''}`}
        onMouseLeave={() => { onHoverChange?.(null); setOverSelection(false); }}
        style={{
          gridTemplateColumns: `50px repeat(${cols.length}, minmax(100px, 1fr))`,
          ...(wiringMode
            ? {
                outline: '1px solid rgba(255, 193, 7, 0.6)',
                outlineOffset: -1,
                borderRadius: 3,
              }
            : {}),
        }}
        role="grid"
      >
        {/* Header Row. The corner is split on its diagonal, as in Excel: the
            upper-left triangle selects the whole table, the lower-right one
            labels the row-number column beneath it. */}
        <div className="grid-header-cell row-index-header grid-corner" style={outline(-1, INDEX_COL)}>
          <button
            type="button"
            className="grid-corner-select"
            aria-label="Select the whole table"
            title="Select the whole table"
            data-state={highlight?.kind === 'all' || shownSel?.kind === 'all' ? 'selected' : hoveredCol === '__table__' ? 'hover' : undefined}
            style={wiringMode ? { cursor: 'crosshair' } : undefined}
            onClick={handleCornerClick}
            onMouseEnter={() => { setHoveredCol('__table__'); noteOver(-1, INDEX_COL); onHoverChange?.({ kind: 'table' }); }}
            onMouseLeave={() => setHoveredCol(null)}
          />
          <button
            type="button"
            className="grid-corner-index"
            aria-label="Select the row index"
            title="Select the row index"
            data-state={indexSelected ? 'selected' : undefined}
            disabled={wiringMode}
            onClick={handleIndexClick}
            onMouseEnter={() => { noteOver(-1, INDEX_COL); onHoverChange?.({ kind: 'column', column: '#' }); }}
          >
            <span className="grid-corner-label" aria-hidden="true">#</span>
          </button>
          {openControl(-1, INDEX_COL)}
        </div>
        {cols.map((col) => (
          <div
            key={col}
            className="grid-header-cell"
            role="columnheader"
            title={wiringMode ? `Select column ${col} (Shift: range, ⌘/Ctrl: add)` : col}
            style={{
              ...wiringColHeaderStyle(col),
              ...(stagedColNames.includes(col) ? { background: '#fff8dc', color: '#665e30' } : {}),
              ...(activeCell?.col === col ? { background: ACTIVE_HEADER_BG } : {}),
              ...outline(-1, col),
            }}
            onClick={(e) => handleColumnClick(col, e)}
            onMouseEnter={() => { if (wiringMode) setHoveredCol(col); noteOver(-1, col); onHoverChange?.({ kind: 'column', column: col }); }}
            onMouseLeave={() => wiringMode && setHoveredCol(null)}
          >
            {col}
            {openControl(-1, col)}
          </div>
        ))}

        {/* Data Rows */}
        {rows.map((r) => (
          <div key={r} className="grid-row" role="row">
            {/* Row Number — in wiring mode this selects the whole row */}
            <div
              className="grid-cell row-index"
              title={wiringMode ? `Select row ${r} (Shift: range, ⌘/Ctrl: add)` : `row ${r}`}
              style={wiringMode ? {
                cursor: 'crosshair',
                background: isRowSelected(r) ? SELECTED_BG : hoveredRow === r ? HOVER_BG : undefined,
                transition: 'background 0.1s ease',
              } : {
                cursor: 'pointer',
                ...(activeCell?.row === r || indexSelected || (shownSel?.kind === 'rows' && inGridSel(shownSel, r, cols[0]))
                  ? { background: ACTIVE_HEADER_BG, color: '#222' } : {}),
                ...outline(r, INDEX_COL),
              }}
              onClick={(e) => handleRowClick(r, e)}
              onMouseEnter={() => { if (wiringMode) setHoveredRow(r); noteOver(r, INDEX_COL, cols[0]); onHoverChange?.({ kind: 'row', row: r }); }}
              onMouseLeave={() => wiringMode && setHoveredRow(null)}
            >
              {r}
            </div>

            {/* Cells */}
            {cols.map((c) => {
              const cell = gridData[`${r}:${c}`];
              const cellKey = `${r}:${c}`;
              const stagedInfo = stagedData[cellKey];
              const isStaged = stagedInfo !== undefined && stagedColNames.includes(c);

              if (isStaged) {
                const isError = stagedInfo.state === 'error';
                const showSpinner = !isError && (stagedCellMode === 'running' || stagedCellMode === 'scheduled');
                const modeLabel = stagedCellMode === 'running'
                  ? 'running'
                  : stagedCellMode === 'scheduled'
                    ? 'scheduled'
                    : 'staged';
                return (
                  <div
                    key={cellKey}
                    className="grid-cell staged"
                    role="gridcell"
                    title={stagedInfo.formula}
                    style={{
                      background: isError ? '#ffebee' : '#fffde7',
                      borderLeft: showSpinner ? '2px solid #ffb300' : undefined,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        color: isError ? '#b71c1c' : '#b8960c',
                        marginRight: 6,
                        fontStyle: 'italic',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      {showSpinner && <span className="cell-wait-spinner" />}
                      ({modeLabel})
                    </span>
                    <span
                      style={{
                        color: isError ? '#8e0000' : '#7a6e30',
                        fontSize: '0.72rem',
                        fontFamily: 'Menlo, Monaco, Consolas, monospace',
                      }}
                    >
                      {stagedInfo.formula}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={cellKey}
                  className={`grid-cell ${cell ? 'has-value' : 'empty'}${isErrorCell(cell) ? ' error-cell' : ''}${isEmptyFrameCell(cell) ? ' empty-frame-cell' : ''}`}
                  role="gridcell"
                  aria-selected={looking ? inGridSel(shownSel, r, c) : undefined}
                  onClick={(e) => {
                    if (cell) handleCellWireClick(cell, e);
                    else if (looking) select({ kind: 'cell', row: r, col: c }, e);
                  }}
                  title={cell?.cell_type ? (cell.summary ?? cell.display_value) : (cell?.display_value ?? '')}
                  style={{ ...wiringCellStyle(cellKey, c), ...outline(r, c) }}
                  onMouseEnter={() => {
                    if (wiringMode) {
                      setHoveredCell(cellKey);
                      setHoveredCol(c);
                    }
                    noteOver(r, c);
                    onHoverChange?.({ kind: 'cell', row: r, column: c, value: cell?.display_value });
                  }}
                  onMouseLeave={() => {
                    if (wiringMode) {
                      setHoveredCell(null);
                      setHoveredCol(null);
                    }
                  }}
                >
                  {cell ? <CellContent cell={cell} /> : ''}
                  {openControl(r, c)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {popovers.map((p) => {
        const ext = selectionExtent(p.sel, rows, cols);
        return (
          <SelectionPopover
            key={p.id}
            stepName={stepName}
            color={stepColor}
            formula={formula}
            what={describeGridSel(p.sel, rows, cols)}
            at={p.at}
            rows={ext.rows}
            cols={ext.cols}
            cells={gridData}
            isSelected={(row, col) => inGridSel(p.sel, row, col)}
            refId={refId}
            wholeColumns={takesWholeColumns(p.sel)}
            onClose={() => setPopovers((ps) => ps.filter((q) => q.id !== p.id))}
          />
        );
      })}
    </div>
  );
}
