import * as React from 'react';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Shrinks its content proportionally when the column is narrower than
 * the content's natural width.
 *
 * The design system scales in three discrete steps and `useFittingSize`
 * picks the largest that fits — but the smallest step still needs about
 * 534px for a three-card river, and a phone does not have it. Without
 * this the row is centred inside a box too small for it and the outer
 * cards are simply clipped off both edges, which on a player's phone
 * means a path they cannot see or tap.
 *
 * A transform is the right tool *here* specifically because a phone is
 * a display surface. The rule against scaling cards protects the print
 * geometry, and nothing is printed from this screen. The alternative —
 * dropping the river to two cards, or letting it scroll sideways — would
 * break the one thing the rules are built on: three paths, compared at
 * a glance.
 *
 * Measurement uses offsetWidth/offsetHeight, which are layout values and
 * are NOT affected by the transform we apply. Reading getBoundingClientRect
 * here would feed the scale back into itself.
 */
export function ScaleToFit({ className, children, style, ...rest }: Props) {
  const outer = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);
  const [fit, setFit] = React.useState({ scale: 1, height: 0 });

  const natural = React.useRef(0);

  const measure = React.useCallback(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;

    const contentWidth = i.offsetWidth;
    const available = o.clientWidth;
    if (!contentWidth || !available) return;
    natural.current = contentWidth;

    const scale = Math.min(1, available / contentWidth);
    const height = i.offsetHeight * scale;

    /*
     * Hysteresis, and it is load-bearing. Writing the height back onto
     * the outer box changes the page's height, which can bring the
     * window's scrollbar in or out, which changes `available` by ~15px,
     * which changes the scale — a loop that React kills with "maximum
     * update depth exceeded". Ignoring sub-pixel churn breaks it.
     */
    setFit((prev) => (
      Math.abs(prev.scale - scale) < 0.005 && Math.abs(prev.height - height) < 1
        ? prev
        : { scale, height }
    ));
  }, []);

  /*
   * The content's natural width changes underneath us when the caller
   * swaps size step — the river mounts at `md` and drops to `sm` a frame
   * later — and a scale computed against the old width would stick
   * forever. So re-measure after a render, but only when the content
   * actually resized. Measuring unconditionally every render is the
   * other way to spin the loop above.
   */
  React.useLayoutEffect(() => {
    if (inner.current && inner.current.offsetWidth !== natural.current) measure();
  });

  React.useLayoutEffect(() => {
    const o = outer.current;
    if (!o) return undefined;

    // Only the column's width matters. Observing the inner element too
    // would feed our own height write straight back in.
    const observer = new ResizeObserver(measure);
    observer.observe(o);

    // A window listener as well as the observer, not instead of it. The
    // observer catches the column changing on its own — the aside
    // appearing at the desktop breakpoint — while this catches a phone
    // being turned sideways even where ResizeObserver is throttled or
    // unavailable, which is the case a player is most likely to hit.
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [measure]);

  return (
    <div
      ref={outer}
      className={className}
      style={{ ...style, ...(fit.height ? { height: `${fit.height}px` } : {}) }}
      {...rest}
    >
      <div
        ref={inner}
        style={{
          // max-content so offsetWidth reports what the row actually wants,
          // not what the column is willing to give it.
          width: 'max-content',
          margin: '0 auto',
          transform: `scale(${fit.scale})`,
          // Left, not centre. Content wider than the column cannot be
          // centred by auto margins — they collapse to zero — so it sits
          // at x=0. Scaling about its own centre then throws it off to
          // the right by half the overflow. From the left edge, content
          // scaled to exactly fit spans the column and lands centred.
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}
