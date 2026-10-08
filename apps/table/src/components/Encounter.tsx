import * as Dialog from '@radix-ui/react-dialog';
import { usePortalContainer } from './PortalHost';

interface Props {
  /** The setting's name for a Monster — a Howler, a Hunter. */
  monster: string;
  onResolve: (outcome: 'won' | 'away' | 'ends') => void;
}

/**
 * The party is found (docs/overhaul.md, phase 4).
 *
 * The run's one fight, and the old board gave it a dialog with three
 * buttons. Here it takes the screen: the threat light floods in from the
 * edges, the vista and the caption above still show the Monster that
 * found them — read there, not repeated here — and
 * "Roll initiative" is set large. Still a blocking Radix dialog — focus
 * held, the board inert, Escape and outside clicks refused — because the
 * crossing cannot go on until the GM reports how the fight went.
 */
export function Encounter({ monster, onResolve }: Props) {
  const container = usePortalContainer();
  const refuse = (e: Event) => e.preventDefault();
  return (
    <Dialog.Root open>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="t-found" />
        <Dialog.Content
          className="t-found__content"
          onEscapeKeyDown={refuse}
          onPointerDownOutside={refuse}
          onInteractOutside={refuse}
          aria-describedby="t-found-note"
        >
          <p className="t-kicker t-found__kicker">The party is found{monster ? ` — ${monster}` : ''}</p>
          <Dialog.Title className="t-found__title">Roll initiative</Dialog.Title>
          <p className="t-note t-found__note" id="t-found-note">
            Run the fight at the table. Winning takes a Monster out of the deck
            for good and the crossing carries on.
          </p>
          <div className="t-found__go">
            <button type="button" className="t-btn t-btn--primary t-btn--lg" autoFocus onClick={() => onResolve('won')}>
              They won
            </button>
            <button type="button" className="t-btn t-btn--lg" onClick={() => onResolve('away')}>
              They got away
            </button>
            <button type="button" className="t-btn t-btn--danger t-btn--lg" onClick={() => onResolve('ends')}>
              It ends here
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
