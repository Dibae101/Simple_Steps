/**
 * TEST: typed cells and the cell viewer (docs/dev_plan/122 §4). A cell richer
 * than text shows its preview or summary in the grid; clicking it opens the
 * full view, fetched separately; wiring mode never opens it.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Cell } from '../types/models';
import type { CellView } from '../services/api';
import DataOutputGrid from './DataOutputGrid';
import CellViewer from './CellViewer';
import CellPanelHost from './CellPanelHost';
import { closeCellPanel } from '../services/cellPanels';

const views: Record<string, CellView> = {
  img: { cell_type: 'image', summary: '16×16 RGB image',
         view: { kind: 'image', src: 'data:image/png;base64,AAAA', width: 16, height: 16 } },
  chart: { cell_type: 'plotly', summary: 'bar chart · 1 trace',
           view: { kind: 'plotly', figure: { data: [{ type: 'bar', x: ['a'], y: [1] }], layout: {} } } },
  tbl: { cell_type: 'table', summary: 'table 2×2',
         view: { kind: 'table', columns: ['a', 'b'], rows: [[1, 'x'], [2, 'y']], total: 2 } },
  obj: { cell_type: 'json', summary: '{2 keys}',
         view: { kind: 'json', value: { city: 'SF', tags: ['a', 'b'] } } },
};

const fetchCellView = vi.fn(async (_ref: string, _row: number, column: string) => views[column]);
vi.mock('../services/api', () => ({
  fetchCellView: (ref: string, row: number, column: string) => fetchCellView(ref, row, column),
}));

const newPlot = vi.fn(async () => {});
vi.mock('plotly.js-dist-min', () => ({ default: { newPlot, purge: vi.fn() } }));

const cells: Cell[] = [
  { row_id: 0, column_id: 'city', value: 'SF', display_value: 'SF' },
  { row_id: 0, column_id: 'img', value: null, display_value: '16×16 RGB image',
    cell_type: 'image', summary: '16×16 RGB image', preview: 'data:image/png;base64,THUMB' },
  { row_id: 1, column_id: 'city', value: 'LA', display_value: 'LA' },
  { row_id: 1, column_id: 'img', value: null, display_value: '16×16 RGB image',
    cell_type: 'image', summary: '16×16 RGB image', preview: 'data:image/png;base64,THUMB' },
];

describe('typed cells in the grid', () => {
  beforeEach(() => fetchCellView.mockClear());

  it('shows a thumbnail and the summary, and plain cells as before', () => {
    const { container } = render(<DataOutputGrid cells={cells} refId="ref1" />);
    expect(screen.getByText('SF')).toBeInTheDocument();
    const thumbs = container.querySelectorAll('img.typed-cell-thumb');
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0].getAttribute('src')).toBe('data:image/png;base64,THUMB');
    expect(screen.getAllByText('16×16 RGB image')).toHaveLength(2);
  });

  it('opens the full view on click, fetching that one cell', async () => {
    render(<DataOutputGrid cells={cells} refId="ref1" />);
    fireEvent.click(screen.getAllByText('16×16 RGB image')[1]);
    await waitFor(() => expect(fetchCellView).toHaveBeenCalledWith('ref1', 1, 'img'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('never opens the viewer while picking data for a formula', () => {
    render(<DataOutputGrid cells={cells} refId="ref1" wiringMode />);
    fireEvent.click(screen.getAllByText('16×16 RGB image')[0]);
    expect(fetchCellView).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('CellViewer', () => {
  const open = (column: string) =>
    render(<CellViewer refId="r" row={0} column={column} onClose={() => {}} />);

  it('shows an image at full size', async () => {
    open('img');
    // The viewer is portalled to <body>, outside the render container.
    await waitFor(() => expect(document.querySelector('img.cv-image')).not.toBeNull());
    expect(document.querySelector('img.cv-image')!.getAttribute('src')).toBe('data:image/png;base64,AAAA');
  });

  it('draws a Plotly figure with plotly.js, loaded only when needed', async () => {
    open('chart');
    await waitFor(() => expect(newPlot).toHaveBeenCalled());
    const [, data] = newPlot.mock.calls[0] as unknown as [HTMLElement, unknown[]];
    expect(data).toEqual([{ type: 'bar', x: ['a'], y: [1] }]);
  });

  it('shows a table in a cell as a table', async () => {
    open('tbl');
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('y')).toBeInTheDocument();
  });

  it('shows a dict as a collapsible tree', async () => {
    open('obj');
    expect(await screen.findByText('"SF"')).toBeInTheDocument();
    expect(screen.getByText('[2 items]')).toBeInTheDocument();
  });
});

describe('cell window controls', () => {
  // The panel store is app-wide; start every test with none open.
  afterEach(() => {
    for (const id of ['r:0:chart', 'r:0:img']) act(() => closeCellPanel(id));
  });

  const openModal = (onClose = vi.fn()) => {
    render(<><CellViewer refId="r" row={0} column="chart" onClose={onClose} /><CellPanelHost /></>);
    return onClose;
  };

  it('expands to the whole window and restores', () => {
    openModal();
    fireEvent.click(screen.getByLabelText('Expand'));
    expect(document.querySelector('.cv-panel.cv-maximized')).not.toBeNull();
    fireEvent.click(screen.getByLabelText('Restore'));
    expect(document.querySelector('.cv-panel.cv-maximized')).toBeNull();
  });

  it('pops out into its own panel and closes the modal view', () => {
    const onClose = openModal();
    fireEvent.click(screen.getByLabelText('Pop out'));
    expect(onClose).toHaveBeenCalled();
    const panel = document.querySelector('.cv-panel.cv-floating');
    expect(panel).not.toBeNull();
    // A panel has no backdrop, so the app behind it stays usable.
    expect(panel!.closest('.cv-backdrop')).toBeNull();
  });

  it('minimizing the modal view pops it out minimized, never leaving a backdrop', () => {
    openModal();
    fireEvent.click(screen.getByLabelText('Minimize'));
    expect(document.querySelector('.cv-floating.cv-minimized')).not.toBeNull();
    expect(document.querySelector('.cv-floating .cv-body')!.hasAttribute('hidden')).toBe(true);
  });

  it('a panel minimizes and restores in place, ignores Esc, and closes with ×', () => {
    openModal();
    fireEvent.click(screen.getByLabelText('Pop out'));
    const panel = () => document.querySelector('.cv-floating');
    fireEvent.click(panel()!.querySelector('[aria-label="Minimize"]')!);
    expect(panel()!.classList.contains('cv-minimized')).toBe(true);
    fireEvent.click(panel()!.querySelector('[aria-label="Restore"]')!);
    expect(panel()!.classList.contains('cv-minimized')).toBe(false);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(panel()).not.toBeNull();
    fireEvent.click(panel()!.querySelector('[aria-label="Close"]')!);
    expect(panel()).toBeNull();
  });

  it('popping the same cell out twice is one panel', () => {
    openModal();
    fireEvent.click(screen.getByLabelText('Pop out'));
    render(<CellViewer refId="r" row={0} column="chart" onClose={() => {}} />);
    fireEvent.click(screen.getAllByLabelText('Pop out')[0]);
    expect(document.querySelectorAll('.cv-floating')).toHaveLength(1);
  });
});
