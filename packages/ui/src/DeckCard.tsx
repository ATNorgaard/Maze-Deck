import * as React from 'react';
import { ArchGlyph } from './ArchGlyph';
import { useCardCopy } from './DeckSkin';
import { CATEGORY_CLASS, DECK_TOTAL, getCategory } from './types';
import type { CardCategory, CardSize } from './types';

/** Splits a rule string so the emphasised phrase can be tinted. */
function renderRule(rule: string, emphasis: string): React.ReactNode {
  const at = emphasis ? rule.indexOf(emphasis) : -1;
  if (at < 0) return rule;
  return (
    <>
      {rule.slice(0, at)}
      <em>{emphasis}</em>
      {rule.slice(at + emphasis.length)}
    </>
  );
}

export interface DeckCardProps {
  /** Which of the seven categories this card is. */
  category: CardCategory;
  /** Override the printed title. Defaults to the category's own. */
  title?: string;
  /** Override the letterspaced kicker above the title. */
  eyebrow?: string;
  /** Override the one-line mechanic. */
  rule?: string;
  /** Show the "N of 28 in deck" odds line. @default true */
  showCount?: boolean;
  /** Override this card's scale independently of the provider. */
  size?: CardSize;
  /** Renders hover/focus affordances and makes the card activatable. */
  onSelect?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * One face-up deck card — the primary component of the system.
 *
 * Every category is the same doorway in a different state, so the
 * only thing that changes between them is the arch's interior,
 * the palette ramp and the corner shape code.
 */
export function DeckCard({
  category,
  title,
  eyebrow,
  rule,
  showCount = true,
  size,
  onSelect,
  className,
  style,
}: DeckCardProps) {
  const def = getCategory(category);
  const interactive = Boolean(onSelect);

  // Three layers: the prop, then the provider's skin, then the canon.
  // A skinned rule brings its own emphasis (or none) — tinting the
  // canonical phrase inside a reworded line would find nothing.
  const skin = useCardCopy(category);
  const printedTitle = title ?? skin.title ?? def.title;
  const printedEyebrow = eyebrow ?? skin.eyebrow ?? def.eyebrow;
  const printedRule = rule
    ? rule
    : skin.rule !== undefined
      ? renderRule(skin.rule, skin.emphasis ?? '')
      : renderRule(def.rule, def.emphasis);

  return (
    <article
      className={['md-card', CATEGORY_CLASS[category], className].filter(Boolean).join(' ')}
      data-size={size}
      data-category={category}
      data-interactive={interactive || undefined}
      style={style}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      onClick={onSelect}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
    >
      <div className="md-card__trim">
        <div className="md-card__light" />
        <div className="md-card__frame" />
        <span className="md-card__code md-card__code--tl" />
        <span className="md-card__code md-card__code--br" />
        <div className="md-card__safe">
          <ArchGlyph state={category} className="md-card__glyph" />
          <p className="md-card__eyebrow">{printedEyebrow}</p>
          <h2 className="md-card__title">{printedTitle}</h2>
          <div className="md-card__divider" />
          <p className="md-card__rule">{printedRule}</p>
        </div>
        {showCount ? (
          <p className="md-card__count">
            {def.expansion ? 'expansion card' : `${def.copies} of ${DECK_TOTAL} in deck`}
          </p>
        ) : null}
      </div>
    </article>
  );
}
