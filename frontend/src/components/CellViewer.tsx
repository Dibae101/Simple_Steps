import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchCellView, type CellView } from '../services/api';
import { openCellPanel } from '../services/cellPanels';
import Icon from './Icon';
import './CellViewer.css';

/**
 * The full view of one cell (docs/dev_plan/122 §4): the image at full size,
 * the interactive Plotly figure, the whole table or dict. The grid shows only
 * a summary and a small preview; this fetches the rest when a cell is opened,
 * so a column of images never loads every full image.
 *
 * Window controls, like a step's: minimize, expand / restore, pull off, close.
 *
 *   inline    — opened in the grid, in a strip under the cell's row. Minimize
 *               folds it to its title bar; expand lifts it over the whole
 *               window, and restore puts it back in the grid.
 *   floating  — pulled off into a panel of its own (`CellPanelHost`): dragged
 *               by its title bar, resized from its corner, open while you keep
 *               working — even after its step collapses.
 */

type Size = 'normal' | 'maximized' | 'minimized';

interface CellViewerProps {
  refId: string;
  row: number;
  column: string;
  onClose: () => void;
  mode?: 'inline' | 'floating';
  startMinimized?: boolean;
  /** Where a new panel opens: each one steps down and right of the last. */
  cascade?: number;
}

/** Panels stack in the order they were last touched. */
let topZ = 2100;

export default function CellViewer({
  refId, row, column, onClose, mode = 'inline', startMinimized = false, cascade = 0,
}: CellViewerProps) {
  const floating = mode === 'floating';
  const [data, setData] = useState<CellView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<Size>(startMinimized ? 'minimized' : 'normal');
  const [pos, setPos] = useState({ x: 96 + cascade * 28, y: 96 + cascade * 28 });
  const [z, setZ] = useState(() => ++topZ);
  // Resizing a panel from its corner writes an inline width and height, which
  // would beat the minimized and expanded styles; so the size is held here,
  // read off the panel whenever it leaves its normal size, and put back on restore.
  const panelRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const resize = (target: Size) => {
    const el = panelRef.current;
    if (floating && size === 'normal' && target !== 'normal' && el) {
      setDims({ width: el.offsetWidth, height: el.offsetHeight });
    }
    setSize(target);
  };

  useEffect(() => {
    let live = true;
    fetchCellView(refId, row, column)
      .then((v) => { if (live) setData(v); })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [refId, row, column]);

  // Esc puts an expanded cell back where it was.
  useEffect(() => {
    if (size !== 'maximized') return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setSize('normal'); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [size]);

  const pullOff = () => {
    openCellPanel({ refId, row, column });
    onClose();
  };

  // Drag a panel by its title bar (not by its buttons, and not while expanded).
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (!floating || size === 'maximized' || (e.target as HTMLElement).closest('button')) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHeaderPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos({
      x: Math.min(Math.max(0, e.clientX - drag.current.dx), window.innerWidth - 120),
      y: Math.min(Math.max(0, e.clientY - drag.current.dy), window.innerHeight - 40),
    });
  };
  const onHeaderPointerUp = () => { drag.current = null; };

  const style = floating
    ? size === 'maximized' ? { zIndex: z, width: 'auto', height: 'auto' }
      : size === 'minimized' ? { left: pos.x, top: pos.y, zIndex: z, width: 300, height: 'auto' }
        : { left: pos.x, top: pos.y, zIndex: z, ...(dims ?? {}) }
    : undefined;

  const panel = (
    <div
      ref={panelRef}
      className={`cv-panel cv-${mode} cv-${size}`}
      style={style}
      onMouseDown={(e) => { e.stopPropagation(); if (floating) setZ(++topZ); }}
      onClick={(e) => e.stopPropagation()}
      role="region"
      aria-label={`Cell ${column}, row ${row}`}
    >
      <div
        className={`cv-header${floating && size !== 'maximized' ? ' cv-draggable' : ''}`}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onDoubleClick={() => resize(size === 'maximized' ? 'normal' : 'maximized')}
      >
        <span className="cv-title">{column} · row {row}</span>
        {data?.summary && <span className="cv-summary">{data.summary}</span>}
        <span className="cv-controls">
          <Control
            label={size === 'minimized' ? 'Restore' : 'Minimize'}
            icon={size === 'minimized' ? 'chrome-restore' : 'chrome-minimize'}
            onClick={() => resize(size === 'minimized' ? 'normal' : 'minimized')}
          />
          <Control
            label={size === 'maximized' ? 'Restore' : 'Expand'}
            icon={size === 'maximized' ? 'chrome-restore' : 'chrome-maximize'}
            onClick={() => resize(size === 'maximized' ? 'normal' : 'maximized')}
          />
          {!floating && <Control label="Pull off" title="Pull off into its own panel" icon="link-external" onClick={pullOff} />}
          <Control label="Close" icon="close" className="cv-close" onClick={onClose} />
        </span>
      </div>
      {/* Kept mounted while minimized, so a chart keeps its zoom and pan. */}
      <div className="cv-body" hidden={size === 'minimized'}>
        {error && <div className="cv-error">{error}</div>}
        {!error && !data && <div className="cv-loading">Loading…</div>}
        {data && <ViewBody view={data.view} />}
      </div>
    </div>
  );

  if (floating) return createPortal(panel, document.body);
  // Expanded, an inline cell is lifted over the whole window. It's portalled,
  // because inside the step column `position: fixed` would be relative to the
  // column and clip it; a click on the backdrop puts it back in the grid.
  if (size === 'maximized') {
    return createPortal(
      <div className="cv-backdrop" onMouseDown={() => setSize('normal')}>{panel}</div>,
      document.body,
    );
  }
  return panel;
}

function Control({ label, title, icon, className = '', onClick }: {
  label: string;
  title?: string;
  icon: string;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button className={`cv-control ${className}`} title={title ?? label} aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <Icon name={icon} size={14} aria-hidden aria-label={undefined} />
    </button>
  );
}

function ViewBody({ view }: { view: CellView['view'] }) {
  switch (view.kind) {
    case 'image':
      return <img className="cv-image" src={view.src} width={view.width} height={view.height} alt="" />;
    case 'plotly':
      return <PlotlyView figure={view.figure} />;
    case 'table':
      return (
        <div className="cv-table-wrap">
          <table className="cv-table">
            <thead><tr>{view.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {view.rows.map((r, i) => (
                <tr key={i}>{r.map((v, j) => <td key={j}>{formatScalar(v)}</td>)}</tr>
              ))}
            </tbody>
          </table>
          {view.total > view.rows.length && (
            <div className="cv-note">Showing {view.rows.length} of {view.total} rows.</div>
          )}
        </div>
      );
    case 'json':
      return <div className="cv-json"><JsonNode value={view.value} open /></div>;
    default:
      return <pre className="cv-text">{view.text}</pre>;
  }
}

function formatScalar(v: unknown): string {
  if (v === null || v === undefined) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

/** A collapsible tree for dicts and lists. */
function JsonNode({ value, label, open = false }: { value: unknown; label?: string; open?: boolean }) {
  const isArray = Array.isArray(value);
  if (value === null || typeof value !== 'object') {
    return (
      <div className="cv-json-leaf">
        {label !== undefined && <span className="cv-json-key">{label}: </span>}
        <span className={`cv-json-${value === null ? 'null' : typeof value}`}>
          {typeof value === 'string' ? JSON.stringify(value) : String(value)}
        </span>
      </div>
    );
  }
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  return (
    <details className="cv-json-node" open={open}>
      <summary>
        {label !== undefined && <span className="cv-json-key">{label}: </span>}
        {isArray ? `[${entries.length} items]` : `{${entries.length} keys}`}
      </summary>
      {entries.map(([k, v]) => <JsonNode key={k} label={k} value={v} />)}
    </details>
  );
}

/** Plotly is loaded only when a chart is opened: it is a separate bundle chunk. */
function PlotlyView({ figure }: { figure: { data?: unknown[]; layout?: Record<string, unknown> } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    const el = ref.current;
    import('plotly.js-dist-min')
      .then((mod) => {
        if (cancelled || !el) return;
        const Plotly = (mod as { default?: PlotlyLike }).default ?? (mod as unknown as PlotlyLike);
        return Plotly.newPlot(el, figure.data ?? [], { autosize: true, ...(figure.layout ?? {}) },
          { responsive: true, displaylogo: false })
          .then(() => {
            if (cancelled || typeof ResizeObserver === 'undefined') return;
            // Plotly's `responsive` follows the window only; a panel resizes on its own.
            observer = new ResizeObserver(() => {
              if (el.offsetWidth > 0 && el.offsetHeight > 0) Plotly.Plots?.resize(el);
            });
            observer.observe(el);
          });
      })
      .catch((e) => { if (!cancelled) setFailed(e instanceof Error ? e.message : String(e)); });
    return () => {
      cancelled = true;
      observer?.disconnect();
      import('plotly.js-dist-min').then((mod) => {
        const Plotly = (mod as { default?: PlotlyLike }).default ?? (mod as unknown as PlotlyLike);
        if (el) Plotly.purge(el);
      }).catch(() => {});
    };
  }, [figure]);

  if (failed) return <div className="cv-error">Couldn't draw the chart: {failed}</div>;
  return <div className="cv-plotly" ref={ref} />;
}

interface PlotlyLike {
  newPlot: (el: HTMLElement, data: unknown[], layout: unknown, config: unknown) => Promise<unknown>;
  purge: (el: HTMLElement) => void;
  Plots?: { resize: (el: HTMLElement) => void };
}
