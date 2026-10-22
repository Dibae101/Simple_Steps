/**
 * StepsStatusContext — what the pointer is over in a step's data grid, for the
 * steps bar's status text (bottom right of the bar under the steps).
 *
 * Two contexts on purpose: grids only need the setter, which never changes, so
 * hovering cell to cell re-renders the status text alone — not every step
 * column that holds a grid.
 */
import { createContext, useContext, useMemo, useState } from 'react';
import type { GridHover } from '../utils/stepsStatus';

type SetHover = (hover: GridHover | null) => void;

const HoverValue = createContext<GridHover | null>(null);
const HoverSetter = createContext<SetHover>(() => {});

export function StepsStatusProvider({ children }: { children: React.ReactNode }) {
  const [hover, setHover] = useState<GridHover | null>(null);
  // useState's setter is stable; memo keeps the setter context's value stable too.
  const setter = useMemo<SetHover>(() => setHover, []);
  return (
    <HoverSetter.Provider value={setter}>
      <HoverValue.Provider value={hover}>{children}</HoverValue.Provider>
    </HoverSetter.Provider>
  );
}

/** What the pointer is over right now, or null. Re-renders on every move. */
// eslint-disable-next-line react-refresh/only-export-components
export function useGridHover(): GridHover | null {
  return useContext(HoverValue);
}

/** Report what the pointer is over (null when it leaves). Never re-renders. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSetGridHover(): SetHover {
  return useContext(HoverSetter);
}
