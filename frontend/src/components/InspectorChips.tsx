import { useInspectors } from '../context/InspectorContext';
import { textOn } from '../utils/contrast';
import SymbolIcon from './SymbolIcon';
import './SelectionInspector.css';

/**
 * Minimized selection inspectors, as chips on the steps bar (the bar between
 * the steps and the console). A chip is the step's colour; clicking it puts
 * the inspector back where it was, × closes it.
 */
export default function InspectorChips() {
  const ctx = useInspectors();
  const minimized = ctx?.inspectors.filter((i) => i.mode === 'minimized') ?? [];
  if (!ctx || minimized.length === 0) return null;
  return (
    <div className="inspector-chips" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      {minimized.map((i) => (
        <span key={i.id} className="inspector-chip" style={{ background: i.color, color: textOn(i.color) }}>
          <button
            type="button"
            className="inspector-chip-open"
            title={`Restore ${i.stepName} · ${i.what}`}
            onClick={() => ctx.restore(i.id)}
          >
            <SymbolIcon name="frame_inspect" size={12} />
            <span>{i.stepName} · {i.what}</span>
          </button>
          <button
            type="button"
            className="inspector-chip-close"
            aria-label={`Close ${i.stepName} · ${i.what}`}
            title="Close"
            onClick={() => ctx.close(i.id)}
          >
            <SymbolIcon name="close" size={11} />
          </button>
        </span>
      ))}
    </div>
  );
}
