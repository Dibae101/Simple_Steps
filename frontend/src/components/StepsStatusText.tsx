import { useGridHover } from '../context/StepsStatusContext';
import { useStepWiring } from '../context/StepWiringContext';
import { stepsStatusText } from '../utils/stepsStatus';

/**
 * The steps bar's status, bottom right: what the pointer is over in a step's
 * grid — `readings · row 3, score = 4.2` — or, while a formula bar is picking
 * a reference, what it has selected. Its own component so a hover re-renders
 * just this text.
 */
export default function StepsStatusText() {
  const hover = useGridHover();
  const { wiringState } = useStepWiring();
  const text = stepsStatusText(hover, wiringState.activeSelection);
  return (
    <span className="steps-footer__status" data-testid="steps-status" title={text || undefined} aria-live="polite">
      {text}
    </span>
  );
}
