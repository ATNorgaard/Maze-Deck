import * as React from 'react';
import { CardBack } from './CardBack';
import { DeckCard } from './DeckCard';
import { RIVER_WIDTH, getCategory } from './types';
import type { CardCategory, CardSize } from './types';

/** One slot in the river. `null` is an unfilled slot, not a gap. */
export interface RiverSlot {
  /** The card in this slot. `null` renders the empty outline. */
  category: CardCategory | null;
  /** Face-down slots hide the category until revealed. */
  faceDown?: boolean;
}

export interface RiverProps {
  /**
   * The river, left to right. Always rendered `width` slots wide
   * even when short — the player must be able to see that a seat
   * is empty rather than watch the row silently close up.
   */
  slots: RiverSlot[];
  /** How many cards the river holds. @default 3 */
  width?: number;
  /** Position labels under each slot. @default Left / Centre / Right */
  labels?: string[];
  /** Called with the slot index when a card is picked. */
  onPick?: (index: number) => void;
  /** Override scale independently of the provider. */
  size?: CardSize;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_LABELS = ['Left', 'Centre', 'Right'];

/**
 * The River — the three paths the party can see right now.
 *
 * Persistent blockers (Dead End, Obstacle) stay face-up in their
 * slot rather than being replaced; that is the whole tension of
 * the mechanic. When three blockers fill the river the component
 * surfaces the penalty warning before it fires.
 */
export function River({
  slots,
  width = RIVER_WIDTH,
  labels = DEFAULT_LABELS,
  onPick,
  size,
  className,
  style,
}: RiverProps) {
  const padded: RiverSlot[] = Array.from(
    { length: width },
    (_, i) => slots[i] ?? { category: null },
  );

  const blockers = padded.filter(
    (s) => s.category && !s.faceDown && getCategory(s.category).blocker,
  ).length;

  return (
    <div
      className={['md-river', className].filter(Boolean).join(' ')}
      data-blockers={blockers}
      style={style}
      role="group"
      aria-label="The river"
    >
      <div className="md-river__slots">
      {padded.map((slot, i) => {
        const blocked = Boolean(slot.category && !slot.faceDown && getCategory(slot.category).blocker);
        return (
          <div className="md-river__slot" key={i} data-blocked={blocked || undefined}>
            {slot.category === null ? (
              <div className="md-river__empty">Empty</div>
            ) : slot.faceDown ? (
              <CardBack size={size} onSelect={onPick ? () => onPick(i) : undefined} />
            ) : (
              <DeckCard
                category={slot.category}
                size={size}
                showCount={false}
                onSelect={onPick ? () => onPick(i) : undefined}
              />
            )}
            <p className="md-river__label">{labels[i] ?? `Slot ${i + 1}`}</p>
          </div>
        );
      })}
      </div>
      {blockers >= width ? (
        <p className="md-river__warning">
          River blocked — clear all, add a Monster
        </p>
      ) : null}
    </div>
  );
}
