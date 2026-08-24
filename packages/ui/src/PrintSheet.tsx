import * as React from 'react';

export interface PrintSheetProps {
  /**
   * Cards to lay out. Six per sheet — three 69mm columns (207mm)
   * do NOT fit A4 once printer margins are taken, which is why
   * the grid is 2-up rather than 3-up.
   */
  children: React.ReactNode;
  /** Screen-only caption. Hidden in print. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * One A4 print sheet: 2 x 3 cards, gutterless.
 *
 * Bleed boxes butt against each other with no gap, so a single
 * guillotine cut serves two neighbouring cards. Print at 100% /
 * actual size — any "fit to page" scaling breaks the 63 x 88mm
 * trim and the cards will not fit standard sleeves.
 */
export function PrintSheet({ children, label, className, style }: PrintSheetProps) {
  return (
    <section className={['md-sheet', className].filter(Boolean).join(' ')} style={style}>
      {label ? <p className="md-sheet__label">{label}</p> : null}
      {children}
    </section>
  );
}
