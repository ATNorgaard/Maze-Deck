/* ============================================================
   The rendering styles.

   A style is how a picture is drawn, independent of what it is
   of. The same scene, tile or ground can be turned out as flat
   silhouettes, as a line drawing, as coarse pixels or as an
   engraving. Every generator takes one and answers to all four.
   ============================================================ */

export type Style = 'flat' | 'line' | 'pixel' | 'engraving';

export interface StyleDef {
  id: Style;
  name: string;
  blurb: string;
}

export const STYLES: readonly StyleDef[] = [
  { id: 'flat', name: 'Flat', blurb: 'Layered silhouettes. The deck as it is drawn today.' },
  { id: 'line', name: 'Line', blurb: 'Outlines only, one weight, no fills.' },
  { id: 'pixel', name: 'Pixel', blurb: 'Coarse grid, ordered dither, hard edges.' },
  { id: 'engraving', name: 'Engraving', blurb: 'Hatched shadow, denser the nearer it comes.' },
];

export function isStyle(x: unknown): x is Style {
  return STYLES.some((s) => s.id === x);
}
