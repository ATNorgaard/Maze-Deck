## Maze Deck — how to build with this library

A card-game design system: a printable 23-card deck ("The River") plus the
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

Category keys: `path` (Clear Path), `obst` (Obstacle), `wand` (Wanderer),
`item`, `mons` (Monster). Plus `dead` (Dead End) and `trap`, which are an
expansion and are **not** in the standard deck.

Colour rules that carry meaning — keep them:

- **Clear Path owns the only warm gold.** Do not use `--md-cat-path-*` for
  anything that is not progress.
- **Dead End is the only achromatic ramp.** A permanent nothing has no hue.
  (Expansion only — it is not in the standard 23.)
- Page background should be `--md-ink-900`; panels `--md-ink-800`.

### 3. Components

| Building | Use |
|---|---|
| A face-up card | `DeckCard category="clear-path" \| "obstacle" \| "wanderer" \| "item" \| "monster"`, plus `"dead-end"` and `"trap"` from the expansion |
| A face-down card | `CardBack` (carries no category — never distinguish one back from another) |
| An action | `AbilityCard ability="forge-a-path" \| "scout-ahead" \| "steel-yourself" \| "its-elementary" \| "careful-consideration" \| "boost-morale"` — one per ability score |
| GM reference | `ReferenceCard variant="loop" \| "deck"` |
| The three visible paths | `River slots={RiverSlot[]}` — `{category, faceDown?}`; `category: null` is an empty slot |
| Draw / discard | `DeckPile count`, `DiscardPile count top?` |
| Win + loss tracks | `ScoreTrack value variant="progress" \| "threat"` |
| The action strip | `ActionBar abilities? locked? dc? onUse?` |
| Initiative | `PlayerSeat name order active? detail?` |
| Print layout | `PrintSheet` (A4, 2 × 3, gutterless) |
| Just the icon | `ArchGlyph state` — any category, any ability, or `"seal"` |

`CATEGORIES`, `CANONICAL_CATEGORIES`, `ABILITIES`, `DECK_TOTAL`, `MAZE_DC`,
`RIVER_WIDTH`, `ESCAPE_TARGET`, `ENCOUNTER_AT`, `OBSTACLE_JAM`, `getCategory()`
and `getAbility()` are exported — read deck facts from those rather than
hardcoding numbers. `CANONICAL_CATEGORIES` is the standard deck;
`CATEGORIES` also includes the expansion.

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
- **Obstacle persists** in the river until somebody spends an action on it.
  Three of them at once ⇒ discard all three and a Monster follows (`River`
  surfaces this warning itself). Dead End persists the same way when the
  expansion is in play.
- A player **acts before committing to a path**, so `ActionBar` belongs at the
  top of a turn, never after a card is turned.
- A locked action stays visible and greyed — players need to see what they
  cannot do this round.
- A **Monster is one strike**, not an instant loss. Two strikes hands the scene
  to the table for a real fight; `ScoreTrack variant="threat"` counts to 2.
