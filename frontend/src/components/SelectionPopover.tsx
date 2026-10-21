import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Cell } from '../types/models';
import { isErrorCell } from '../utils/errorCells';
import { shortExpression } from '../utils/expression';
import CellViewer from './CellViewer';
import Icon from './Icon';
import './SelectionPopover.css';

/**
 * The selection popover (spec 014 §8): a thin frame around an enlarged copy
 * of the data a person selected, opened from the control on the selection's
 * border.
 *
 * - Opens centred where it was opened (REQ-VIS-040), kept on screen.
 * - Clicking anywhere else closes it; dragging its frame moves it and pins it,
 *   and a pinned popover stays until its close control (REQ-VIS-044).
 * - The header is the expression that produced the data, short; clicking it
 *   shows the whole expression, plus one state line (REQ-VIS-046/047).
 * - A single image, figure or table cell is the cell viewer, embedded: the
 *   popover owns the window controls, so they aren't doubled.
 *
 * Isolation: every event inside stops here. The popover is portalled to the
 * body, but React still bubbles a portal's events to its owner, so without
 * this a click inside would also select in the grid behind it. And a drag
 * starts only from the frame itself, never from the content, so zooming a
 * chart or scrolling a table never moves the popover.
 *
 * Inputs and outputs (the left and right edges, REQ-VIS-042/043) come once
 * the app runs one core workflow per session (dev_plan/124 phase 2).
 */

export interface SelectionPopoverProps {
  /** The step's name, as written in wf["…"]. */
  stepName: string;
  /** The step's colour (its header's). */
  color?: string;
  /** The step's formula. */
  formula?: string;
  /** The selection in one line: `rows 1–2 × city–n · 2×2`. */
  what: string;
  /** Where it was opened (viewport coordinates); the popover centres on it. */
  at: { x: number; y: number };
  rows: number[];
  cols: string[];
  /** The grid's cells, "row:column" → cell. */
  cells: Record<string, Cell>;
  /** Whether a cell of the extent is part of the selection (scattered picks leave gaps). */
  isSelected: (row: number, col: string) => boolean;
  /** The output the cells come from, so a typed cell can show its full view. */
  refId?: string;
  onClose: () => void;
}

/** Popovers stack in the order they were last touched; under pulled-off cells (2100). */
let topZ = 2050;
const MARGIN = 8;

export default function SelectionPopover({
  stepName, color = '#888', formula, what, at, rows, cols, cells, isSelected, refId, onClose,
}: SelectionPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [pinned, setPinned] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [full, setFull] = useState(false);
  const [z, setZ] = useState(() => ++topZ);

  // Centre on where it was opened, kept inside the window.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || pos) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setPos({
      x: Math.min(Math.max(MARGIN, at.x - w / 2), Math.max(MARGIN, window.innerWidth - w - MARGIN)),
      y: Math.min(Math.max(MARGIN, at.y - h / 2), Math.max(MARGIN, window.innerHeight - h - MARGIN)),
    });
  }, [at, pos]);

  // A click anywhere else closes it, and so does Esc — unless it's pinned.
  useEffect(() => {
    if (pinned) return;
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [pinned, onClose]);

  // Drag by the frame (its header strip and edges), never by its content or buttons.
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const onFramePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (!pos || target.closest('button, .sp-content')) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onFramePointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPinned(true);
    setPos({
      x: Math.min(Math.max(0, e.clientX - drag.current.dx), window.innerWidth - 120),
      y: Math.min(Math.max(0, e.clientY - drag.current.dy), window.innerHeight - 40),
    });
  };
  const onFramePointerUp = () => { drag.current = null; };

  // One state line for what's selected. Phase 3 brings core's per-cell states;
  // until then: failed when a selected cell holds an error, else current.
  const selected = rows.flatMap((r) => cols.filter((c) => isSelected(r, c)).map((c) => cells[`${r}:${c}`]));
  const failed = selected.find((c) => isErrorCell(c));
  const state = failed ? `failed · ${failed.display_value}` : selected.every((c) => !c) ? 'empty' : 'current';

  const single = rows.length === 1 && cols.length === 1 ? cells[`${rows[0]}:${cols[0]}`] : undefined;
  const embedded = !!(single?.cell_type && refId);
  const short = shortExpression(formula);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return createPortal(
    <div
      ref={ref}
      className={`sp-frame${pinned ? ' sp-pinned' : ''}${minimized ? ' sp-minimized' : ''}`}
      style={{ left: pos?.x ?? -9999, top: pos?.y ?? -9999, zIndex: z, ['--sp-color' as string]: color }}
      role="dialog"
      aria-label={`${stepName} · ${what}`}
      onMouseDown={(e) => { stop(e); setZ(++topZ); }}
      onClick={stop}
      onDoubleClick={stop}
      onContextMenu={stop}
      onKeyDown={stop}
      onPointerDown={onFramePointerDown}
      onPointerMove={onFramePointerMove}
      onPointerUp={onFramePointerUp}
    >
      <div className="sp-header">
        <span className="sp-step">{stepName}</span>
        <span className="sp-what">{what}</span>
        <span className="sp-controls">
          {pinned && <Icon name="pinned" size={13} className="sp-pin" title="Pinned: stays open until closed" />}
          <button
            className="sp-control"
            aria-label={minimized ? 'Restore' : 'Minimize'}
            title={minimized ? 'Restore' : 'Minimize'}
            onClick={() => setMinimized((m) => !m)}
          >
            <Icon name={minimized ? 'chrome-restore' : 'chrome-minimize'} size={13} aria-hidden aria-label={undefined} />
          </button>
          <button className="sp-control" aria-label="Close" title="Close" onClick={onClose}>
            <Icon name="close" size={13} aria-hidden aria-label={undefined} />
          </button>
        </span>
      </div>
      {!minimized && (
        <>
          {short && (
            <button
              className={`sp-expression${full ? ' sp-full' : ''}`}
              aria-expanded={full}
              title={full ? 'Show it short' : 'Show the whole expression'}
              onClick={() => setFull((f) => !f)}
            >
              <code>{full ? (formula ?? '').replace(/^=/, '') : short}</code>
            </button>
          )}
          <div className={`sp-state${failed ? ' sp-state-failed' : ''}`}>{state}</div>
          <div className="sp-content">
            {embedded ? (
              <CellViewer refId={refId!} row={rows[0]} column={cols[0]} mode="embedded" onClose={onClose} />
            ) : (
              <table className="sp-table">
                <thead>
                  <tr>
                    <th className="sp-index" aria-label="row" />
                    {cols.map((c) => <th key={c}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r}>
                      <th className="sp-index" scope="row">{r}</th>
                      {cols.map((c) => {
                        const cell = cells[`${r}:${c}`];
                        const inSel = isSelected(r, c);
                        return (
                          <td
                            key={c}
                            className={`${inSel ? '' : 'sp-unselected'}${isErrorCell(cell) ? ' sp-error' : ''}`}
                          >
                            {inSel && cell ? (cell.cell_type ? (cell.summary ?? cell.display_value) : cell.display_value) : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
