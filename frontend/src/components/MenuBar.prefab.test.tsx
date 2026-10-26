/**
 * TEST-PFB-32: File → Export Results as Prefab Page… (docs/spec/015-prefab-views.md,
 * REQ-PFB-032). Shown only when the host wires it, disabled until a step has
 * output, and a click calls the host's handler.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MenuBar from './MenuBar';

const base = { workflowName: 'Readings', onNew: () => {}, onSave: () => {}, onSaveAs: () => {}, onRename: () => {} };
const openFileMenu = () => fireEvent.click(screen.getByRole('button', { name: /file/i }));

describe('Export Results as Prefab Page (spec 015)', () => {
  it('is absent when the host does not wire it', () => {
    render(<MenuBar {...base} />);
    openFileMenu();
    expect(screen.queryByText('Export Results as Prefab Page…')).toBeNull();
  });

  it('is disabled until a step has output', () => {
    render(<MenuBar {...base} onExportPrefab={() => {}} canExportPrefab={false} />);
    openFileMenu();
    expect(screen.getByText('Export Results as Prefab Page…').closest('button')).toBeDisabled();
  });

  it('calls the handler when there is output', () => {
    const onExportPrefab = vi.fn();
    render(<MenuBar {...base} onExportPrefab={onExportPrefab} canExportPrefab />);
    openFileMenu();
    fireEvent.click(screen.getByText('Export Results as Prefab Page…'));
    expect(onExportPrefab).toHaveBeenCalledOnce();
  });
});
