import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { usePortalContainer } from './PortalHost';

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
 * Built on Radix Dialog for the things a hand-rolled modal gets wrong:
 * it traps focus, restores it to whatever opened the dialog on close,
 * marks the rest of the page inert for screen readers, and locks the
 * background from scrolling.
 *
 * Portalled into `.md-root` rather than the body — see PortalHost. The
 * look is unchanged: `.t-scrim` and `.t-modal` still do all the styling.
 */
export function Modal({ label, dismissible = false, onDismiss, children }: Props) {
  const container = usePortalContainer();

  // Radix closes on Escape and on an outside click. A modal the game is
  // waiting on has to refuse both, or the board is left with no way on.
  const block = (e: Event) => { if (!dismissible) e.preventDefault(); };

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => { if (!next && dismissible) onDismiss?.(); }}
    >
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="t-scrim" />
        <div className="t-modalLayer">
          <Dialog.Content
            className="t-modal"
            onEscapeKeyDown={block}
            onPointerDownOutside={block}
            onInteractOutside={block}
          >
            {/* Radix requires a title for the accessible name. It is the
                same string the old aria-label carried, just reachable. */}
            <Dialog.Title className="t-sr">{label}</Dialog.Title>
            {children}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
