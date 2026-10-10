# Art directions: the designs before the builds

Two directions for each of the six settings (art jobs 1–6), drawn as
mock-ups for the author to choose from before anything is built
(docs/art-jobs.md, "A design first"). The published page is
<https://claude.ai/artifact/4CKTL8Pw7XAqLiUWFdtXYV>. The author's picks
and notes are saved there, in the page's `choices` store, one document per
setting.

These pictures are the spec. A setting's build in `packages/art` and the
world renderer should match the direction picked for it, at the game's own
sizes.

- `px.js`: a small pixel painter of its own (ramps and values, lights,
  coloured light, masonry, flagstones in perspective, natural rock, rims
  for silhouettes, sprites and particles). It is independent of
  `packages/art`, so a design is not limited by what is built.
- `scenes/<setting>.js`: each setting's two directions: `back(96, 134)`,
  `vista(W, H, category)` and `world(320, 200)`.
- `page.html` + `build.cjs`: the review page. `node build.cjs` writes
  `art-directions.html`; `node build.cjs dungeon,tower out.html` builds some.
- `inspect.cjs <setting>`: draws a setting's designs large into `shots/`,
  with build times and the world's luminance budget (0.023 behind the
  caption, the river and the hand).
- `shoot.cjs <setting>`: photographs the built page for one setting.
- `pagecheck.cjs`: the page at phone width and in light mode.
- `AGENT-BRIEF.md`: the brief the settings were drawn to, with what the
  first dungeon taught about craft.

The scripts use the Chromium in `.ds-sync` (see `scripts/print-deck.mjs`).
