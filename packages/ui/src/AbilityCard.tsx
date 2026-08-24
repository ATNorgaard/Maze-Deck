import * as React from 'react';
import { ArchGlyph } from './ArchGlyph';
import { MAZE_DC, getAbility } from './types';
import type { AbilityKey, CardSize } from './types';

export interface AbilityCardProps {
  /** Which of the five ability-keyed actions this card is. */
  ability: AbilityKey;
  /** Difficulty printed on the check line. @default 13 */
  dc?: number;
  /**
   * Disabled by the end-of-round d6 lockout. The card stays in
   * place greyed rather than disappearing — players need to see
   * what they cannot do this round.
   */
  locked?: boolean;
  /** Show the italic "so what?" footnote. @default true */
  showRationale?: boolean;
  /** Override this card's scale independently of the provider. */
  size?: CardSize;
  /** Renders hover/focus affordances and makes the card activatable. */
  onSelect?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * One of the five ability cards.
 *
 * Inverted to a parchment ground so it is never mistaken for a
 * deck card lying face-up — but it runs the identical rhythm
 * underneath: glyph, ability score, name, divider, effect.
 */
export function AbilityCard({
  ability,
  dc = MAZE_DC,
  locked = false,
  showRationale = true,
  size,
  onSelect,
  className,
  style,
}: AbilityCardProps) {
  const def = getAbility(ability);
  const interactive = Boolean(onSelect) && !locked;

  return (
    <article
      className={['md-card', 'md-card--ability', 'md-cat-path', className].filter(Boolean).join(' ')}
      data-size={size}
      data-ability={ability}
      data-locked={locked || undefined}
      data-interactive={interactive || undefined}
      style={style}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      aria-disabled={locked || undefined}
      onClick={interactive ? onSelect : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(); }
            }
          : undefined
      }
    >
      <div className="md-card__trim">
        <div className="md-card__frame" />
        <div className="md-card__safe">
          <ArchGlyph state={ability} className="md-card__glyph" />
          <p className="md-card__eyebrow">{def.scoreName}</p>
          <h2 className="md-card__title">{def.title}</h2>
          <div className="md-card__divider" />
          <p className="md-ability__effect">{def.effect}</p>
          {showRationale ? <p className="md-ability__why">{def.why}</p> : null}
        </div>
        <p className="md-card__count">
          {locked ? 'Locked this round' : `${def.score} check · DC ${dc}`}
        </p>
      </div>
    </article>
  );
}
