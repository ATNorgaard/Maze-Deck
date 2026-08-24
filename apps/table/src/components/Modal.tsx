import * as React from 'react';

interface Props {
  label: string;
  /**
   * Acknowledgements can be waved away. Anything the game is waiting on
   * cannot — dismissing a pending check would leave the board with no
   * visible way forward.
   */
  dismissible?: boolean;
  onDismiss?: () => void;
  children: React.ReactNode;
}

/**
 * Deliberately not portalled. Every token lives on `.md-root`, which the
 * provider emits at the top of the app; rendering into document.body
 * would drop out of that scope and paint unstyled. `position: fixed`
 * does the job from inside the tree.
 */
export function Modal({ label, dismissible = false, onDismiss, children }: Props) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    ref.current?.focus();
    if (!dismissible || !onDismiss) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissible, onDismiss]);

  return (
    <div
      className="t-scrim"
      role="presentation"
      onClick={dismissible && onDismiss ? onDismiss : undefined}
    >
      <div
        ref={ref}
        className="t-modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
