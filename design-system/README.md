# Maze Deck — design system v1.2

A print-first design system for a 28-card dungeon-navigation deck ("The River"),
plus five illustrated ability cards. Everything renders from three files; there
is no build step and no dependency.

```
design-system/
  tokens.css       single source of truth — colour, type, geometry, deck counts
  components.css   card anatomy, category theming, print sheet layout
  deck.html        icon system + deck model + sheet assembly
print/
  MazeDeck_PRINT_v3.pdf    15 A4 pages, ready to print
```

## The core idea

**Every card is the same doorway.** The arch is constant; what stands in it
changes. That holds for the deck cards *and* the ability cards — an ability is
another doorway, and what stands in it is the tool the character brings.

### Deck cards

| Category | The arch is… | Shape code | Hue |
|---|---|---|---|
| Clear Path | open, a corridor receding toward light | ● circle | torch amber |
| Dead End | bricked shut | ■ square | stone (achromatic) |
| Obstacle | a portcullis grid coming down | ▬ bar, horizontal | verdigris |
| Trap | spikes springing up from the floor | ▲ triangle | acid |
| Monster | full of dark, with something in it | ⁚ two dots | blood |
| Wanderer | occupied — a cloaked figure with a staff | ▮ bar, vertical | steel blue |
| Item | holding a chest, light coming off it | ✚ cross | orchid |

### Ability cards

| Ability | Check | The arch holds… |
|---|---|---|
| Forge a Path | STR | a smith's hammer |
| Scout Ahead | DEX | a lantern carried forward |
| It's Elementary | INT | a magnifier |
| Careful Consideration | WIS | a balance |
| Boost Morale | CHA | a rallying banner |

Ability cards invert to a parchment ground so they are never mistaken for deck
cards face-up, but they run the identical rhythm: glyph → ability score →
name → divider → effect.

## Three ways to be stopped

Dead End, Obstacle and Trap are mechanically distinct, and the glyphs encode
the difference — Obstacle descends from the top, Trap springs from the floor,
Dead End is simply masonry:

| | How it ends |
|---|---|
| **Dead End** | Cannot be solved. Only Boost Morale (CHA) clears it. |
| **Obstacle** | Can be worked on. Stays in the river until an action check resolves it. |
| **Trap** | Resolves at once — check DC 13 ±1 — and leaves the game either way. |

Three blockers in the river at once: clear all, add a Monster.

## Deck composition

| | Count | Share |
|---|---|---|
| Clear Path | 6 | 21% |
| Dead End · Obstacle · Trap | 4 · 4 · 3 = 11 | 39% |
| Wanderer · Item | 4 · 4 = 8 | 29% |
| Monster | 3 | 11% |
| **Total** | **28** | |

Threat sits a little below the 13.3% of the original 15-card deck. Set
`--count-monster: 4` (a 29-card deck, 13.8%) to restore that pacing exactly.

## Colour and shape at seven categories

Two constraints drove the palette and the marks, and both are worth knowing
before you change either.

**Hue can no longer carry identification alone.** Six chromatic hues on a dark
ground are close enough at 12 mm that the glyph and the shape code do the
identifying and the hue only confirms it. So the palette's real job here is
*grouping*: blockers sit cool and desaturated, the two encounters sit at
opposite poles, and the single card that means progress owns the only warm gold.
Dead End is the one **achromatic** ramp — a permanent nothing should have no hue,
which also makes it the one category that survives any colour-vision deficiency
untouched.

**No two shape codes may be 180° rotations of each other.** The mark prints
top-left *and* bottom-right so the card reads either way up — which means a
triangle-up/triangle-down pair would be ambiguous on a rotated card, as would
square/diamond. Bar-vertical and bar-horizontal are safe: a 180° turn leaves
each one's orientation unchanged, and a 2:1 aspect flip is one of the most
salient cues at this size.

## Print specification

| | |
|---|---|
| Trim | 63 × 88 mm (standard poker) |
| Bleed | 3 mm per edge → 69 × 94 mm artwork |
| Safe zone | 4 mm inside trim — nothing meaningful crosses it |
| Corner radius | 3 mm |
| Sheet | A4 portrait, **2 × 3 = 6 cards**, gutterless |

Three 69 mm columns (207 mm) do **not** fit A4 once printer margins are taken —
that is why the grid is 2-up. Cards butt with no gutter, so one guillotine cut
serves two neighbouring cards.

Sheet order: proof (3) → deck faces (5) → card backs (5) → abilities and
reference (2). Fifteen A4 pages.

## Printing it

Open `deck.html` in a browser and print to PDF, or use the checked-in
`print/MazeDeck_PRINT_v3.pdf`. Print at **100% / actual size** — any "fit to
page" scaling breaks the 63 × 88 mm trim.

Cut guides: add `?guides=1` to the URL to draw the trim (magenta) and safe
(cyan) outlines.

```bash
python -m http.server 8791 --directory design-system
```

For a home prototype, print faces only and use opaque card sleeves — the deck is
dealt face-down, so the backs must be indistinguishable, and sleeve backs are
more reliable than duplex registration.

## Changing the deck

Deck composition lives in `tokens.css` and nowhere else. `deck.html` reads it at
runtime via `getComputedStyle`, so this really is the only place to edit:

```css
--count-path:      6;   /* collect 5 to escape       */
--count-dead:      4;
--count-obstacle:  4;
--count-trap:      3;
--count-wanderer:  4;
--count-item:      4;
--count-monster:   3;   /* 2 revealed forces a fight */
--river-width:     3;
--maze-dc:        13;   /* the single scaling dial   */
```

Raise `--maze-dc` and the whole maze scales: the Trap card, every ability card's
check line and the reference card all follow, because each is expressed relative
to it.

Card copy lives in the `CATEGORIES` / `ACTIONS` arrays in `deck.html`.

### Adding a category

Answer one question: *what has happened to the arch?* Then add a `--cat-<key>-*`
ramp, a `.cat-<key>` scoping class, a shape code that is not a 180° rotation of
an existing one, and one new `<symbol>`. Nothing else changes.

## Provenance

The mechanics come from the project's own methodology document (*Metodisk
vejledning: Teknisk orkestrering af labyrint-systemet*) — the river, the turn
order, the five ability-keyed actions, Maze DC 13 and the d6 action lockout.
The seven-category structure combines that deck's Dead End and Trap with the
Obstacle / Wanderer / Item types.

The visual language — the arch-state icon system, the ability glyphs, palette,
typography, card anatomy and layout — is original to this project.

`Deck-of-Dungeons_PRINT-COLOR_1.0.pdf` and the podcast cover image in the
repository root are third-party works (Tales From the Stinky Dragon / Rooster
Teeth). They were read as *mechanical* reference only. None of their artwork,
lettering, iconography or branding is reproduced here, and none of it should be
used in anything shipped.
