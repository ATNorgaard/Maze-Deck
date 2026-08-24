import * as React from 'react';
import { createRoot } from 'react-dom/client';
import {
  MazeDeckProvider, DeckCard, CardBack, AbilityCard, ReferenceCard, PrintSheet,
  River, DeckPile, DiscardPile, ScoreTrack, ActionBar, PlayerSeat,
  CATEGORIES, ABILITIES,
} from '../src/index';

const H: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 style={{
    font: '600 13px/1 Inter, system-ui, sans-serif', letterSpacing: '.22em',
    textTransform: 'uppercase', color: '#7d8f99', margin: '40px 0 14px',
  }}>{children}</h2>
);

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>{children}</div>
);

function Demo() {
  return (
    <MazeDeckProvider size="sm" style={{ padding: 28, minHeight: '100vh' }}>
      <H>Deck cards — seven states</H>
      <Row>{CATEGORIES.map((c) => <DeckCard key={c.category} category={c.category} />)}</Row>

      <H>Card back + reference</H>
      <Row>
        <CardBack />
        <ReferenceCard variant="loop" />
        <ReferenceCard variant="deck" />
      </Row>

      <H>Ability cards</H>
      <Row>
        {ABILITIES.map((a) => <AbilityCard key={a.ability} ability={a.ability} />)}
        <AbilityCard ability="scout-ahead" locked />
      </Row>

      <H>River — face-down, mixed, blocked</H>
      <River slots={[{ category: 'clear-path', faceDown: true }, { category: 'clear-path', faceDown: true }, { category: 'clear-path', faceDown: true }]} />
      <div style={{ height: 14 }} />
      <River slots={[{ category: 'obstacle' }, { category: 'clear-path', faceDown: true }, { category: null }]} />
      <div style={{ height: 14 }} />
      <River slots={[{ category: 'dead-end' }, { category: 'obstacle' }, { category: 'trap' }]} />

      <H>Piles</H>
      <Row>
        <DeckPile count={19} />
        <DiscardPile count={6} top="item" />
        <DeckPile count={0} />
        <DiscardPile count={0} />
      </Row>

      <H>Tracks</H>
      <Row>
        <ScoreTrack value={3} />
        <ScoreTrack value={1} variant="threat" />
      </Row>

      <H>Action bar — one locked</H>
      <ActionBar locked={['its-elementary']} />

      <H>Seats</H>
      <Row>
        <PlayerSeat name="Brakka" order={1} active detail="Fighter · STR 18" />
        <PlayerSeat name="Wren" order={2} detail="Rogue · DEX 17" />
      </Row>

      <H>Print sheet (2 × 3, actual size)</H>
      <MazeDeckProvider size="md" style={{ padding: 0, background: 'transparent' }}>
        <PrintSheet label="Proof">
          {CATEGORIES.slice(0, 5).map((c) => <DeckCard key={c.category} category={c.category} />)}
          <CardBack />
        </PrintSheet>
      </MazeDeckProvider>
    </MazeDeckProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Demo />);
