import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { usePortalContainer } from './PortalHost';

interface Props {
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * A sheet from the right edge, for the things the table does not need
 * to look at while it plays: the GM's controls.
 *
 * The same Radix Dialog as Modal — focus trapped while open, restored
 * to the button that opened it, Escape and an outside click close it —
 * and portalled into `.md-root` for the same reason (see PortalHost).
 * Unlike Modal it is always dismissible: nothing in it is owed.
 */
export function Drawer({ label, open, onOpenChange, children }: Props) {
  const container = usePortalContainer();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="t-drawerScrim" />
        <Dialog.Content className="t-drawer" aria-describedby={undefined}>
          <div className="t-drawer__head">
            <Dialog.Title className="t-drawer__title">{label}</Dialog.Title>
            <Dialog.Close className="t-btn t-drawer__close" aria-label="Close">×</Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
