## Maze Deck — how to build with this library

A card-game design system: a printable 28-card deck ("The River") plus the
digital surfaces a table needs. One motif runs through everything — **every
card is the same doorway, and only what stands in it changes.**

### 1. Wrap everything in `MazeDeckProvider`

**Required.** Every token is defined on `.md-root`, which only
`MazeDeckProvider` emits. A component rendered outside it resolves no custom
properties and paints as unstyled boxes — it does not throw, it just silently
looks wrong.

```jsx
<MazeDeckProvider size="md">
  <River slots={[{ category: 'clear-path', faceDown: true }, { category: 'obstacle' }, { category: null }]} />
</MazeDeckProvider>
```

`size` is `"sm" | "md" | "lg"` and rescales the entire system, because every
dimension, type size and hairline derives from one unit (`--md-u`: 0.62mm /
1mm / 1.35mm). Each card also takes its own `size` prop that overrides the
provider for that card. Use `sm` when several cards share a row; `md` is
print-accurate (63 × 88 mm trim).

### 2. Style your own layout with tokens, never with new colours

There are **no utility classes**. The library's `.md-*` classes are internal —
do not apply them to your own elements. For your layout glue, use flex/grid
plus these CSS variables (all exist in `_ds/<folder>/styles.css`):

| Purpose | Variables |
|---|---|
| Ground | `--md-ink-900` (darkest) … `--md-ink-500` |
| Text on ink | `--md-parchment-100` … `--md-parchment-400` |
| Category ramp | `--md-cat-<key>-500 / -300 / -700 / -glow` |
| Type | `--md-font-display` (Cinzel), `--md-font-body` (Spectral), `--md-font-ui` |
| Scale unit | `--md-u` — multiply it: `calc(6 * var(--md-u))` |

Category keys: `path` (Clear Path), `dead` (Dead End), `obst` (Obstacle),
`trap`, `mons` (Monster), `wand` (Wanderer), `item`.

Colour rules that carry meaning — keep them:

- **Clear Path owns the only warm gold.** Do not use `--md-cat-path-*` for
  anything that is not progress.
- **Dead End is the only achromatic ramp.** A permanent nothing has no hue.
- Page background should be `--md-ink-900`; panels `--md-ink-800`.

### 3. Components

| Building | Use |
|---|---|
| A face-up card | `DeckCard category="clear-path" \| "dead-end" \| "obstacle" \| "trap" \| "monster" \| "wanderer" \| "item"` |
| A face-down card | `CardBack` (carries no category — never distinguish one back from another) |
| An action | `AbilityCard ability="forge-a-path" \| "scout-ahead" \| "its-elementary" \| "careful-consideration" \| "boost-morale"` |
| GM reference | `ReferenceCard variant="loop" \| "deck"` |
| The three visible paths | `River slots={RiverSlot[]}` — `{category, faceDown?}`; `category: null` is an empty slot |
| Draw / discard | `DeckPile count`, `DiscardPile count top?` |
| Win + loss tracks | `ScoreTrack value variant="progress" \| "threat"` |
| The action strip | `ActionBar abilities? locked? dc? onUse?` |
| Initiative | `PlayerSeat name order active? detail?` |
| Print layout | `PrintSheet` (A4, 2 × 3, gutterless) |
| Just the icon | `ArchGlyph state` — any category, any ability, or `"seal"` |

`CATEGORIES`, `ABILITIES`, `DECK_TOTAL`, `MAZE_DC`, `RIVER_WIDTH`,
`ESCAPE_TARGET`, `CONFRONTATION_AT`, `getCategory()` and `getAbility()` are
exported — read deck facts from those rather than hardcoding numbers.

### 4. Where the truth lives

Read `_ds/<folder>/styles.css` before styling anything — it holds every token
with the reasoning inline. Each component's `.d.ts` is the prop contract and
its `.prompt.md` is the usage reference.

### 5. An idiomatic screen

```jsx
<MazeDeckProvider size="sm" style={{ minHeight: '100vh', padding: 'calc(8 * var(--md-u))' }}>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(6 * var(--md-u))' }}>
    <div style={{ display: 'flex', gap: 'calc(4 * var(--md-u))' }}>
      <ScoreTrack value={3} />
      <ScoreTrack value={1} variant="threat" />
    </div>
    <River slots={[
      { category: 'clear-path', faceDown: true },
      { category: 'obstacle' },
      { category: 'item', faceDown: true },
    ]} onPick={(i) => pick(i)} />
    <div style={{ display: 'flex', gap: 'calc(6 * var(--md-u))' }}>
      <DeckPile count={19} onDraw={draw} />
      <DiscardPile count={6} top="item" />
    </div>
    <ActionBar locked={['its-elementary']} onUse={use} />
  </div>
</MazeDeckProvider>
```

### 6. Rules the UI should not contradict

- The river is **always three wide**. An empty slot holds its width; the row
  never closes up.
- Dead End and Obstacle **persist** in the river. Three blockers at once ⇒
  clear all and add a Monster (`River` surfaces this warning itself).
- A player **acts before the reveal**, so `ActionBar` belongs at the top of a
  turn, never after a card is turned.
- A locked action stays visible and greyed — players need to see what they
  cannot do this round.
