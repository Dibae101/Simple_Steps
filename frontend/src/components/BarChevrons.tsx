import Icon from './Icon';
import './BarChevrons.css';

interface BarChevronsProps {
  /** What ⌃ does, as its label (e.g. "Collapse steps"). */
  upLabel: string;
  /** What ⌄ does, as its label (e.g. "Expand steps"). */
  downLabel: string;
  onUp: () => void;
  onDown: () => void;
  /** The move that is already done is disabled, not hidden, so the pair never shifts. */
  upDisabled?: boolean;
  downDisabled?: boolean;
}

/**
 * The ⌃/⌄ pair at the left edge of the steps footer and of the console's title
 * bar. Steps: ⌃ collapses, ⌄ expands/maximizes. Console: ⌃ minimizes, ⌄
 * expands. Both bars use this one component, so the pairs line up in one
 * column and look alike.
 */
export default function BarChevrons({
  upLabel, downLabel, onUp, onDown, upDisabled = false, downDisabled = false,
}: BarChevronsProps) {
  return (
    <span className="bar-chevrons" onMouseDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="log-collapse-btn bar-chevron"
        onClick={onUp}
        disabled={upDisabled}
        title={upLabel}
        aria-label={upLabel}
      >
        <Icon name="chevron-up" size={12} />
      </button>
      <button
        type="button"
        className="log-collapse-btn bar-chevron"
        onClick={onDown}
        disabled={downDisabled}
        title={downLabel}
        aria-label={downLabel}
      >
        <Icon name="chevron-down" size={12} />
      </button>
    </span>
  );
}
