# Atelier

A seeded, procedural workbench for the deck's artwork. Everything it draws
is a pure function of a biome, a style, a seed and a few sliders, so any
piece can be reproduced from its recipe, and nothing it makes is anyone
else's work.

```bash
cd apps/atelier && npm install && npm run dev     # http://localhost:5181
node scripts/capture-atelier.cjs                  # a contact sheet into proof/atelier/
```

The app is built like `apps/table`: Vite and React, with `@maze-deck/ui`
aliased to **source**, so the previews are the real cards and a token edited
in `packages/ui` or in `apps/table/src/biomes.css` shows up on the next hot
reload. There is no workspace root — `npm install` here, not at the top.

## The two axes

Every bench takes the same two global choices from the bar.

- **Biome** — which of the six settings. The atelier does not duplicate the
  biome's content; it reads the real palette off `biomes.css` at runtime
  (`src/ui/usePalette.tsx`) and adds only a drawing vocabulary
  (`packages/art/src/biomes.ts`): what the horizon is made of, what drifts in the
  air, which category lights the room.
- **Style** — how it is drawn: `flat` silhouettes, `line` outlines, `pixel`
  with an ordered dither, or `engraving` with hatching that thickens as it
  comes forward. The same model renders in all four.

Change the seed, or press *Reroll*, and every bench redraws. Sliders are
remembered per bench in localStorage.

## The benches

| Bench | Makes | Exports |
|---|---|---|
| **Back** | The card back's field. Either a 24-unit seamless tile — the walls of a maze, its passages, or a square fret; seamless because the maze is generated on a torus — or, in **Scene** mode, the setting's own horizon across the whole back, carrying no subject, behind the seal and frame exactly as the maze sits today. | A tile: the `FIELD` line for `CardBack.tsx`. A scene: an SVG for `backArt` on the biome (see below). Both as SVG and PNG. |
| **Scene** | What stands in the doorway: a sky lit by the category's colour, a horizon built from the biome's terrain, and the card's subject in front. Drawn on the glyph's own 120 × 140 grid, or as a 240 × 140 panel. The arch glyph on the card face is not changed by this; the scene is a separate picture. | SVG and PNG at print-usable size. |
| **Ground** | The page behind the table: the setting's ink, a pool of its light, a texture, whatever is in the air, a vignette. With **Animate** on, the motion is inside the SVG — the pool breathes, snow falls, embers rise, dust drifts — as SMIL, so the file moves on its own as an `<img>` or a CSS background. Pixel style moves in steps. | A `--t-biome-ground` value for `biomes.css` (gradients with the texture inlined, or the animated file as the top layer); SVG and PNG at any size, 2560 × 1440 by default. |
| **Palette** | A new biome's colours from a cast: ink ramp, parchment ramp, and the seven category hues tuned within their families. | The CSS block in the shape `biomes.css` expects. |

## Recipes, and the bake

Every bench's state can be given in the URL — `?bench=back&biome=tower&seed=x&back.mode=scene`
sets the globals and a bench's fields (see `src/ui/store.ts`). The code panel
prints the recipe of what it is showing. That is how the art the table app
ships is made: `scripts/bake-art.cjs` holds one recipe per biome, asks the
running atelier for each back and ground, and saves the SVGs into
`apps/table/src/biomes/art/`. To re-roll a setting, change its seed in the
script and run it again:

```bash
node scripts/bake-art.cjs            # flat; or: node scripts/bake-art.cjs pixel
```

## Where the outputs go

The benches never write into the library or the table app themselves; each
shows the paste-ready text and the buttons, and the bake script or the human
decides. The landing places are:

- a back tile → `packages/ui/src/CardBack.tsx` (`FIELD`) and the
  `CardBackMotif` union in `DeckSkin.tsx`, then `motif:` in the biome file;
- a back scene → `apps/table/src/biomes/art/back-<biome>.svg`, imported as
  `backArt` in the biome file. `DeckSkin.backArt` carries it to `CardBack`,
  which draws it in place of the maze; the motif stays as the print deck's
  back and the fallback;
- a ground → `apps/table/src/biomes/art/ground-<biome>.svg`, the top layer of
  the biome's `--t-biome-ground` in `apps/table/src/biomes.css` (the old
  gradient stays beneath as the fallback);
- a palette → a new block in `biomes.css`, plus the biome's own file under
  `apps/table/src/biomes/` (see the note at the top of `index.ts` there);
- a scene → wherever a picture is wanted. The arch frame matches the
  `ArchGlyph` grid, so it can also be traced into a new glyph interior.

## Layout of the code

```
src/core/     export helpers (SVG text, PNG, downloads)
src/gen/      the generators the table does not use: tile, ground, palette — pure, no React state

packages/art/ rng, style, biome vocabulary + palette reader, and the scene generator —
              moved out so the table can draw scenes live (docs/overhaul.md, phase 2)
src/ui/       controls, the export panel, localStorage, the palette probe
src/benches/  one file per bench: controls on the left, stage, export on the right
```

The generators return SVG elements with a `viewBox` only — no size, no CSS
variables — so the same element previews in the page and serialises to a
standalone file.
