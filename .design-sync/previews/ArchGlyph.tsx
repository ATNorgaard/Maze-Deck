import * as React from 'react';
import { ArchGlyph } from '@maze-deck/ui';

const Cell = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
    <div style={{ width: 78, height: 90 }}>{children}</div>
    <figcaption style={{
      font: '600 9px/1 Cinzel, Georgia, serif', letterSpacing: '.18em',
      textTransform: 'uppercase', color: '#9B8F74',
    }}>{label}</figcaption>
  </figure>
);

/** One motif, seven states — the whole deck vocabulary. */
export const DeckStates = () => (
  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
    <Cell label="Clear Path"><ArchGlyph state="clear-path" style={{ color: '#F2CB8A' }} /></Cell>
    <Cell label="Dead End"><ArchGlyph state="dead-end" style={{ color: '#B2B1AD' }} /></Cell>
    <Cell label="Obstacle"><ArchGlyph state="obstacle" style={{ color: '#7FC0AC' }} /></Cell>
    <Cell label="Trap"><ArchGlyph state="trap" style={{ color: '#C7D477' }} /></Cell>
    <Cell label="Monster"><ArchGlyph state="monster" style={{ color: '#D9707C' }} /></Cell>
    <Cell label="Wanderer"><ArchGlyph state="wanderer" style={{ color: '#A6C0D4' }} /></Cell>
    <Cell label="Item"><ArchGlyph state="item" style={{ color: '#C08FCE' }} /></Cell>
  </div>
);

/** The five abilities — the tool the character brings. */
export const AbilityStates = () => (
  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
    <Cell label="Forge a Path"><ArchGlyph state="forge-a-path" style={{ color: '#F2CB8A' }} /></Cell>
    <Cell label="Scout Ahead"><ArchGlyph state="scout-ahead" style={{ color: '#F2CB8A' }} /></Cell>
    <Cell label="It's Elementary"><ArchGlyph state="its-elementary" style={{ color: '#F2CB8A' }} /></Cell>
    <Cell label="Careful Consideration"><ArchGlyph state="careful-consideration" style={{ color: '#F2CB8A' }} /></Cell>
    <Cell label="Boost Morale"><ArchGlyph state="boost-morale" style={{ color: '#F2CB8A' }} /></Cell>
  </div>
);

/** The category-neutral seal used on the card back. */
export const Seal = () => (
  <div style={{ width: 96, height: 112, color: '#8A5E1E' }}>
    <ArchGlyph state="seal" title="Maze Deck seal" />
  </div>
);
