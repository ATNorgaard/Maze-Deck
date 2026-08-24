import * as React from 'react';
import { DeckCard } from '@maze-deck/ui';
import type { CardCategory, Choice, ChoicePayload, GameView } from '@maze-deck/rules';

interface Props {
  view: GameView;
  choice: Choice;
  onResolve: (payload: ChoicePayload) => void;
}

const POSITION = ['left', 'centre', 'right'];
const position = (i: number) => POSITION[i] ?? `slot ${i + 1}`;

function CardButton({
  card, label, selected, onClick,
}: {
  card: CardCategory;
  label: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="t-pick"
      aria-pressed={selected ?? false}
      aria-label={label}
      onClick={onClick}
    >
      <DeckCard category={card} size="sm" showCount={false} />
    </button>
  );
}

/**
 * The phase the old prototype could not express. Three of the six
 * actions hand information over and then ask what to do with it,
 * which is exactly why the prototype had quietly rewritten them
 * into one-shot effects.
 */
export function ChoicePanel({ view, choice, onResolve }: Props) {
  const [slot, setSlot] = React.useState<number | null>(null);

  switch (choice.kind) {
    case 'scout-top':
      return (
        <div className="t-panel t-panel--live">
          <h2 className="t-panel__title">Scouted off the deck</h2>
          <p className="t-note">
            One goes back on top and will be the next card drawn. The rest are
            shuffled back in. Players are told a card was set, never which.
          </p>
          <div className="t-cards" style={{ marginTop: 'calc(3 * var(--md-u))' }}>
            {choice.cards.map((card, i) => (
              <CardButton
                key={`${card}-${i}`}
                card={card}
                label={`Put ${card} on top of the deck`}
                onClick={() => onResolve({ kind: 'scout-top', cardIndex: i })}
              />
            ))}
          </div>
        </div>
      );

    case 'swap-river': {
      const occupied = view.river
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.filled);
      return (
        <div className="t-panel t-panel--live">
          <h2 className="t-panel__title">Swap one into the river</h2>
          <p className="t-note">
            Pick a drawn card, then the path it replaces. What it displaces is
            discarded; anything left over goes back on top of the deck.
          </p>
          <div className="t-cards" style={{ marginTop: 'calc(3 * var(--md-u))' }}>
            {choice.cards.map((card, i) => (
              <CardButton
                key={`${card}-${i}`}
                card={card}
                label={`Choose ${card}`}
                selected={slot === i}
                onClick={() => setSlot(i)}
              />
            ))}
          </div>
          <p className="t-note" style={{ marginTop: 'calc(3 * var(--md-u))' }}>
            {slot === null ? 'Choose a card first.' : 'Now choose the path it replaces.'}
          </p>
          <div className="t-row" style={{ marginTop: 'calc(2 * var(--md-u))' }}>
            {occupied.map(({ i }) => (
              <button
                key={i}
                type="button"
                className="t-btn"
                disabled={slot === null}
                onClick={() => onResolve({ kind: 'swap-river', cardIndex: slot as number, slot: i })}
              >
                Replace the {position(i)}
              </button>
            ))}
          </div>
        </div>
      );
    }

    case 'discard-revealed':
      return (
        <div className="t-panel t-panel--live">
          <h2 className="t-panel__title">Strike one from the river</h2>
          <p className="t-note">
            Both are face up on the table now. Discard one; the rest are
            shuffled and turned back down.
          </p>
          <div className="t-cards" style={{ marginTop: 'calc(3 * var(--md-u))' }}>
            {choice.slots.map((i) => {
              const card = view.river[i]?.category;
              if (!card) return null;
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 'calc(2 * var(--md-u))', alignItems: 'center' }}>
                  <DeckCard category={card} size="sm" showCount={false} />
                  <button
                    type="button"
                    className="t-btn"
                    onClick={() => onResolve({ kind: 'discard-revealed', slot: i })}
                  >
                    Discard the {position(i)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      );

    case 'boost-target':
      return (
        <div className="t-panel t-panel--live">
          <h2 className="t-panel__title">Who gets the advantage?</h2>
          <p className="t-note">
            They roll two dice and keep the better on their next check or save.
          </p>
          <div className="t-row" style={{ marginTop: 'calc(3 * var(--md-u))' }}>
            {view.seats.map((s) => (
              <button
                key={s.id}
                type="button"
                className="t-btn"
                onClick={() => onResolve({ kind: 'boost-target', seatId: s.id })}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      );

    case 'wanderer-stays':
      return (
        <div className="t-panel t-panel--live">
          <h2 className="t-panel__title">Does the wanderer keep pace?</h2>
          <p className="t-note">
            Some travel on with the party and hold their place in the river;
            others go their own way. Your call, and your scene.
          </p>
          <div className="t-row" style={{ marginTop: 'calc(3 * var(--md-u))' }}>
            <button
              type="button"
              className="t-btn"
              onClick={() => onResolve({ kind: 'wanderer-stays', stays: true })}
            >
              They stay
            </button>
            <button
              type="button"
              className="t-btn t-btn--primary"
              onClick={() => onResolve({ kind: 'wanderer-stays', stays: false })}
            >
              They move on
            </button>
          </div>
        </div>
      );
  }
}
