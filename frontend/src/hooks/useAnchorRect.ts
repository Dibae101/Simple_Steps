import { useLayoutEffect, useState, type RefObject } from 'react';

export interface AnchorRect {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
}

/**
 * The anchor element's on-screen box while `active`, kept current on scroll and
 * resize. A dropdown rendered into `document.body` with `position: fixed` uses
 * it to stay attached to the button that opened it — which is what lets it
 * escape every parent's stacking context and overflow clipping.
 */
export function useAnchorRect(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
): AnchorRect | null {
  const [rect, setRect] = useState<AnchorRect | null>(null);

  useLayoutEffect(() => {
    if (!active) return;
    const update = () => {
      const r = ref.current?.getBoundingClientRect();
      if (r) setRect({ top: r.top, left: r.left, bottom: r.bottom, right: r.right, width: r.width });
    };
    update();
    // capture: true so scrolling inside any pane moves the popover with it
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [active, ref]);

  // A layout effect runs before paint, so a reopened popover never shows at
  // the box it had last time.
  return active ? rect : null;
}
