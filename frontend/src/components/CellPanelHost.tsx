import CellViewer from './CellViewer';
import { closeCellPanel, useCellPanels } from '../services/cellPanels';

/** Every cell pulled off into its own panel. Mounted once, in App. */
export default function CellPanelHost() {
  const panels = useCellPanels();
  return (
    <>
      {panels.map((p, i) => (
        <CellViewer
          key={p.id}
          refId={p.refId}
          row={p.row}
          column={p.column}
          floating
          startMinimized={p.minimized}
          cascade={i}
          onClose={() => closeCellPanel(p.id)}
        />
      ))}
    </>
  );
}
