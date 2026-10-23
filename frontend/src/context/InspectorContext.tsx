/**
 * InspectorContext — every open selection inspector (spec 014 §8).
 *
 * An inspector opens *in place* over the selection it shows (docked), can be
 * pulled off into a floating window, and minimized into a chip on the steps
 * bar (InspectorChips). Because the grid, the floating windows and the steps
 * bar all show them, they live here rather than in one grid.
 *
 * A grid registers an *anchor* — where a selection of its sits on screen —
 * so a docked inspector can follow it as the page scrolls. When the grid goes
 * away (its step collapses), its docked inspectors float where they are.
 *
 * Mount InspectorProvider once, high in the app. A grid rendered without one
 * (tests, a stand-alone page) brings its own (DataOutputGrid).
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Cell } from '../types/models';
import type { GridSel } from '../utils/gridSelection';
import SelectionInspector from '../components/SelectionInspector';

export type InspectorMode = 'docked' | 'floating' | 'minimized';

/** What an inspector shows: a copy of the selection when it was opened. */
export interface InspectorData {
  stepName: string;
  color: string;
  formula?: string;
  refId?: string;
  /** The selection in one line: `rows 1–2 × city–n · 2×2`. */
  what: string;
  rows: number[];
  cols: string[];
  cells: Record<string, Cell>;
  sel: GridSel;
  /** The selection takes whole columns: show every row of the step. */
  wholeColumns: boolean;
}

export interface Inspector extends InspectorData {
  id: number;
  /** The grid it was opened from. */
  owner: string;
  mode: InspectorMode;
  /** Where a minimized inspector goes back to. */
  restoreTo: 'docked' | 'floating';
  /** A floating inspector's top-left, in viewport pixels. */
  pos: { x: number; y: number } | null;
  z: number;
}

/** Where a selection of a grid is on screen, or null when it isn't drawn. */
export type Anchor = (sel: GridSel) => DOMRect | null;

export interface InspectorContextValue {
  inspectors: Inspector[];
  /** Open an inspector, docked; one already open on the same selection comes forward instead. */
  open: (owner: string, data: InspectorData) => void;
  update: (id: number, patch: Partial<Inspector>) => void;
  close: (id: number) => void;
  /** Bring to the front. */
  raise: (id: number) => void;
  /** Un-minimize, back where it was (docked only if its grid is still there). */
  restore: (id: number) => void;
  registerAnchor: (owner: string, anchor: Anchor) => () => void;
  anchorOf: (inspector: Inspector) => DOMRect | null;
}

export const InspectorContext = createContext<InspectorContextValue | null>(null);

/** The open inspectors and their actions. Null outside an InspectorProvider. */
export function useInspectors(): InspectorContextValue | null {
  return useContext(InspectorContext);
}

const sameSel = (a: GridSel, b: GridSel) =>
  a.kind === b.kind && a.cells.join('|') === b.cells.join('|') && a.headers.join('|') === b.headers.join('|');

/** Inspectors stack in the order they were last touched; under pulled-off cells (2100). */
let topZ = 2050;
let nextId = 1;

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const anchors = useRef(new Map<string, Anchor>());

  const update = useCallback((id: number, patch: Partial<Inspector>) => {
    setInspectors((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const raise = useCallback((id: number) => update(id, { z: ++topZ }), [update]);

  const anchorOf = useCallback((i: Inspector) => anchors.current.get(i.owner)?.(i.sel) ?? null, []);

  const restore = useCallback((id: number) => {
    setInspectors((list) => list.map((i) => {
      if (i.id !== id) return i;
      const docked = i.restoreTo === 'docked' && anchors.current.get(i.owner)?.(i.sel);
      return { ...i, mode: docked ? 'docked' : 'floating', z: ++topZ };
    }));
  }, []);

  const open = useCallback((owner: string, data: InspectorData) => {
    setInspectors((list) => {
      const same = list.find((i) => i.owner === owner && sameSel(i.sel, data.sel));
      if (same) {
        return list.map((i) => (i === same
          ? { ...i, mode: i.mode === 'minimized' ? i.restoreTo : i.mode, z: ++topZ } : i));
      }
      return [...list, { ...data, id: nextId++, owner, mode: 'docked', restoreTo: 'docked', pos: null, z: ++topZ }];
    });
  }, []);

  const close = useCallback((id: number) => {
    setInspectors((list) => list.filter((i) => i.id !== id));
  }, []);

  const registerAnchor = useCallback((owner: string, anchor: Anchor) => {
    anchors.current.set(owner, anchor);
    return () => {
      if (anchors.current.get(owner) === anchor) anchors.current.delete(owner);
    };
  }, []);

  const value = useMemo<InspectorContextValue>(
    () => ({ inspectors, open, update, close, raise, restore, registerAnchor, anchorOf }),
    [inspectors, open, update, close, raise, restore, registerAnchor, anchorOf],
  );

  return (
    <InspectorContext.Provider value={value}>
      {children}
      {inspectors.filter((i) => i.mode !== 'minimized').map((i) => (
        <SelectionInspector key={i.id} inspector={i} />
      ))}
    </InspectorContext.Provider>
  );
}
