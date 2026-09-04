import * as React from 'react';
import { DeckSkinProvider } from './DeckSkin';
import type { DeckSkin } from './DeckSkin';
import type { CardSize } from './types';

export interface MazeDeckProviderProps {
  /**
   * Base scale for everything inside. Every dimension, type size
   * and hairline derives from one unit, so this resizes the whole
   * system in proportion rather than just the card box.
   * @default "md"
   */
  size?: CardSize;
  /** Draw trim and safe-zone guides over every card. Proofing only. */
  guides?: boolean;
  /** Page/table background. Defaults to the deck's own ink ground. */
  background?: string;
  /**
   * Reskin every card underneath: per-category copy and the card
   * back's field pattern. Colour is not here on purpose — scope a
   * palette in CSS instead, the tokens are custom properties for
   * exactly that. Nested providers inherit whatever they omit.
   */
  skin?: DeckSkin;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Root wrapper for the Maze Deck design system.
 *
 * REQUIRED. Every token lives on `.md-root`, so a component
 * rendered outside this wrapper resolves no custom properties
 * and paints as unstyled boxes — it will not throw, it will
 * just silently look wrong. Wrap once, as high as convenient.
 */
export function MazeDeckProvider({
  size = 'md',
  guides = false,
  background,
  skin,
  className,
  style,
  children,
}: MazeDeckProviderProps) {
  return (
    <div
      className={['md-root', guides ? 'md-guides' : '', className].filter(Boolean).join(' ')}
      data-size={size}
      style={{ background: background ?? 'var(--md-ink-900)', color: 'var(--md-parchment-200)', ...style }}
    >
      <DeckSkinProvider skin={skin ?? {}}>{children}</DeckSkinProvider>
    </div>
  );
}
