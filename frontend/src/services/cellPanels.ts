import { useSyncExternalStore } from 'react';

/**
 * Cells pulled off into their own panel. They live here, not in the grid that
 * opened them, so a panel stays open when its step collapses or scrolls away,
 * and several can be open at once. `CellPanelHost` (mounted once, in App)
 * renders them.
 */

export interface CellPanel {
  id: string;
  refId: string;
  row: number;
  column: string;
}

let panels: CellPanel[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openCellPanel(panel: Omit<CellPanel, 'id'>): void {
  const id = `${panel.refId}:${panel.row}:${panel.column}`;
  // The same cell twice is one panel, brought back rather than duplicated.
  panels = [...panels.filter((p) => p.id !== id), { ...panel, id }];
  emit();
}

export function closeCellPanel(id: string): void {
  panels = panels.filter((p) => p.id !== id);
  emit();
}

export function useCellPanels(): CellPanel[] {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => panels,
  );
}
