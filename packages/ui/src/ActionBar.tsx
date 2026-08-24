import * as React from 'react';
import { ArchGlyph } from './ArchGlyph';
import { ABILITIES, MAZE_DC } from './types';
import type { AbilityKey } from './types';

export interface ActionBarProps {
  /**
   * Which abilities are available this session. Under 5 players,
   * cut this to party size — scarcity and specialisation are the
   * point, so the list is explicit rather than always all five.
   * @default all five
   */
  abilities?: AbilityKey[];
  /**
   * Abilities disabled by the end-of-round d6 lockout. Locked
   * actions stay in place greyed rather than disappearing.
   */
  locked?: AbilityKey[];
  /** Difficulty shown on each check line. @default 13 */
  dc?: number;
  /** Called with the ability when an available action is chosen. */
  onUse?: (ability: AbilityKey) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The five core actions, as a table-facing control strip.
 *
 * A player takes ONE action before any card is revealed — acting
 * on incomplete information is the whole design, so this bar is
 * live at the top of a turn, never after the reveal.
 */
export function ActionBar({
  abilities,
  locked = [],
  dc = MAZE_DC,
  onUse,
  className,
  style,
}: ActionBarProps) {
  const list = abilities ?? ABILITIES.map((a) => a.ability);

  return (
    <div
      className={['md-actionbar', className].filter(Boolean).join(' ')}
      style={style}
      role="group"
      aria-label="Actions"
    >
      {list.map((key) => {
        const def = ABILITIES.find((a) => a.ability === key);
        if (!def) return null;
        const isLocked = locked.includes(key);
        return (
          <button
            type="button"
            className="md-action"
            key={key}
            data-ability={key}
            data-locked={isLocked || undefined}
            disabled={isLocked}
            onClick={isLocked ? undefined : () => onUse?.(key)}
          >
            <span className="md-action__glyph">
              <ArchGlyph state={key} />
            </span>
            <span className="md-action__name">{def.title}</span>
            {isLocked ? (
              <span className="md-action__locked">Locked</span>
            ) : (
              <span className="md-action__check">
                {def.score} · DC {dc}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
