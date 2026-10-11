# New settings: the brief

The author added eight settings (2026-10-11) so Maze Deck can carry any kind
of high-fantasy adventure. **Each is a standalone setting** a GM picks for a
crossing, not a stop on a journey. Each has the sides the author chose:

| id | Setting | Sides |
|---|---|---|
| `kings-road` | The King's Road | outside |
| `mire` | The Mire (swamp) | outside |
| `high-road` | The High Road (mountain pass) | outside, inside (a mountain cave) |
| `drowned-coast` | The Drowned Coast | outside, inside |
| `barrow-moor` | The Barrow Moor (the Shadowfell's edge) | outside, inside |
| `ember-hold` | The Ember Hold | outside (volcanic landscape, **no dwarven gate**), inside (the forge hall) |
| `underdark` | The Underdark | inside |
| `sunken-jungle` | The Sunken Jungle | outside, inside |

Each setting's sketch (light, props, how the dark closes in, what each card
becomes, sound) is in `docs/new-settings.md`. Start from it, and make it
better.

## Read first

1. `AGENT-BRIEF.md`: the rules (sizes, the luminance budget, reserved card
   colours, speed) and the craft notes. All of it applies.
2. `px.js`: the painter. Never edit it.
3. Good examples to match in craft:
   - `scenes/dungeon.js`, direction A (inside): torchlight on stone, a
     backlit monster;
   - `scenes/frozen-pass.js`, direction A (outside): sky high, table low;
   - `scenes/desert.js`, direction C (inside): light shafts, seated colossi.

## What the author has taught us

These came from the author's notes on the first six. Treat them as rules.

- **No light at the end of the way on a back.** A face-down card is the
  unknown. Light at the end of a path, a door or a tunnel reads as the Clear
  Path card. Only the Clear Path's vista may show the way opening into light.
- **An inside has no openings to the outside**, no window onto daylight that
  reads as a quick way out. An inside is lit from within: fire, fungus,
  crystal, lava, ghost-light.
- **Murk was rejected.** Every picture needs a strong focal light, objects
  with lit edges, and clear silhouettes. Dark is fine; muddy is not.
- **The Monster must have a shape:** a silhouette you can name, rimmed by the
  light, not a blob with eyes.
- **No big dithered tints.** A card's colour on a subject is clean value
  bands plus a small, strong glow (`p.light`, or a tight `p.tint`), never a
  large checkerboard cloud.
- **The vista's five cards** (Monster, Obstacle, Wanderer, Item, Clear Path)
  each read at a glance at 192 × 72 and 312 × 62. The Obstacle must
  obviously block the way.

## What to write

One file per setting: `scenes/<id>.js`, in the dungeon's shape, an IIFE
that pushes its designs onto `window.DESIGNS`. One design per side:

- `setting: '<id>'`, `job: 0`, `name` (as in the table, without the bracket);
- `key: 'A'` for the outside and `'B'` for the inside (a one-sided setting
  has only its own); `id: '<id>-a'` or `'<id>-b'`; `side: 'outside'` or
  `'inside'`;
- `title`, `pitch`, `notes` (Light, Detail, Vista, World), `palette`, and
  `back(96, 134)`, `vista(W, H, category)`, `world(320, 200)`.

Where a setting has two sides, they are the same place: the same palette
family, materials and motifs, so one is recognisably the other's other side.

Run `node inspect.cjs <id>` and `node shoot.cjs <id>` from
`C:\Coding\Maze-Deck\docs\art-directions`, and look at every PNG. Iterate at
least four rounds per design. Edit only your own scene file; never px.js,
the page, the scripts, other scenes or docs; never commit.

Report back in under 200 words: each design in a few lines, what you are
proudest of, what is weak, build times, and the luminance numbers.
