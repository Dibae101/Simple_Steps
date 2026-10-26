/**
 * TEST-PFB-10..12: Prefab views in cells (docs/spec/015-prefab-views.md).
 * The grid shows a Prefab cell as an icon and its summary, never the view;
 * the opened viewer puts the backend's page in one sandboxed iframe (scripts
 * only, never same-origin), says so when no page could be built, and shows a
 * renderer failure only when that frame itself reports it.
 */
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Cell } from '../types/models';
import type { CellView } from '../services/api';
import DataOutputGrid from './DataOutputGrid';
import CellViewer from './CellViewer';

const PAGE = '<!doctype html><html><head><title>Readings</title></head><body><div id="root"></div></body></html>';

const views: Record<string, CellView> = {
  board: { cell_type: 'prefab', summary: 'Prefab view · Readings',
           view: { kind: 'prefab', html: PAGE, title: 'Readings' } },
  broken: { cell_type: 'prefab', summary: 'Prefab view · Card',
            view: { kind: 'prefab', html: null, title: 'Card', error: 'PrefabPageError: no data block' } },
};

const fetchCellView = vi.fn(async (_ref: string, _row: number, column: string) => views[column]);
vi.mock('../services/api', () => ({
  fetchCellView: (ref: string, row: number, column: string) => fetchCellView(ref, row, column),
}));

const cells: Cell[] = [
  { row_id: 0, column_id: 'city', value: 'SF', display_value: 'SF' },
  { row_id: 0, column_id: 'card', value: null, display_value: 'Prefab view · Card · SF',
    cell_type: 'prefab', summary: 'Prefab view · Card · SF' },
];

describe('Prefab views (spec 015)', () => {
  beforeEach(() => fetchCellView.mockClear());

  it('TEST-PFB-11: the grid shows the icon and summary, never a live view', () => {
    // REQ-PFB-010, REQ-PFB-013
    const { container } = render(<DataOutputGrid cells={cells} refId="ref1" />);
    expect(screen.getByText('Prefab view · Card · SF')).toBeInTheDocument();
    expect(container.querySelector('.typed-cell-icon svg')).not.toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(fetchCellView).not.toHaveBeenCalled();
  });

  it('TEST-PFB-10: the opened view is one iframe, sandboxed to scripts only, with the page as srcdoc', async () => {
    // REQ-PFB-010
    const { container } = render(<CellViewer refId="ref1" row={0} column="board" onClose={() => {}} />);
    await waitFor(() => expect(container.querySelector('iframe.cv-prefab')).not.toBeNull());
    const frames = container.querySelectorAll('iframe');
    expect(frames).toHaveLength(1);
    expect(frames[0].getAttribute('sandbox')).toBe('allow-scripts');
    expect(frames[0].getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(frames[0].getAttribute('srcdoc')).toBe(PAGE);
    expect(frames[0].getAttribute('title')).toBe('Prefab view: Readings');
  });

  it('TEST-PFB-12: no page means a readable error, not a blank frame', async () => {
    // REQ-PFB-012
    const { container } = render(<CellViewer refId="ref1" row={0} column="broken" onClose={() => {}} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't show this Prefab view: PrefabPageError: no data block");
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('TEST-PFB-12: a failure is shown only when the frame itself reports it', async () => {
    // REQ-PFB-012
    const { container } = render(<CellViewer refId="ref1" row={0} column="board" onClose={() => {}} />);
    await waitFor(() => expect(container.querySelector('iframe.cv-prefab')).not.toBeNull());
    const frame = container.querySelector('iframe') as HTMLIFrameElement;
    await waitFor(() => expect(frame.contentWindow).not.toBeNull());
    const report = { source: 'simple-steps-prefab', type: 'error', message: 'TypeError: t.some is not a function' };

    // From any other window: ignored.
    act(() => { window.dispatchEvent(new MessageEvent('message', { data: report, source: window })); });
    expect(screen.queryByRole('alert')).toBeNull();
    // The renderer's own handshake, from the frame: ignored.
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { jsonrpc: '2.0', method: 'ui/initialize' }, source: frame.contentWindow }));
    });
    expect(screen.queryByRole('alert')).toBeNull();
    // From the frame: shown, as text.
    act(() => { window.dispatchEvent(new MessageEvent('message', { data: report, source: frame.contentWindow })); });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The Prefab view failed in its renderer: TypeError: t.some is not a function');
  });
});
