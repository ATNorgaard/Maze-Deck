/* ============================================================
   @maze-deck/art — the deck's pictures, from a seed.

   Moved out of apps/atelier so the table can draw at runtime
   what the atelier draws on its benches (docs/overhaul.md, phase
   2, D5). Pure: every picture is a function of a setting, a style,
   a seed and a palette read off the CSS. React only for the SVG it
   returns — no state, no effects, no DOM beyond reading a palette.
   ============================================================ */

export * from './rng';
export * from './biomes';
export * from './style';
export * from './scene';
