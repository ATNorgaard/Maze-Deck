# Art directions: the designs before the builds

Every setting's art was designed here first, as mock-ups the author chose
from on a review page: <https://claude.ai/artifact/4CKTL8Pw7XAqLiUWFdtXYV>.
The author's picks and notes are saved there, in the page's `choices` and
`review` stores, one document per setting.

**The designs themselves now live in the art package**, as the one source
the game plays and this page shows (docs/settings-build.md, S3):
- `packages/art/src/paint/px.js`: the pixel painter, independent of the
  older scene generator. It handles ramps and values per pixel, lights as
  fields weighed per frame, coloured light, masonry, flagstones in
  perspective, natural rock, rims for silhouettes, sprites and particles.
- `packages/art/src/paint/settings/<setting>.js`: each setting's designs.
  Each has `back(96, 134)`, `vista(W, H, subject)` and `world(320, 200)`,
  and a `side` (inside or outside) for the ones the game plays.
- `packages/art/src/paint/index.ts`: the typed way in.
  - `SIDES`: which sides each setting has.
  - `designFor(setting, side)`: loads one setting at a time.
  - `vistaOf`: maps any card to what a design draws (a Dead End and a Trap
    as the way blocked, in their own colours).
- `packages/art/test/paint.test.ts` holds every played design to the rules:
  - a design for every side;
  - the same picture for the same moment;
  - the luminance budget behind the words;
  - every card drawable.

What stays here:
- `page.html` + `build.cjs`: the review page, built from the package.
  `node build.cjs` writes `art-directions.html`;
  `node build.cjs dungeon,tower out.html` builds some settings only.
- `inspect.cjs <setting>`: draws a setting's designs large into `shots/`,
  with build times and the world's luminance budget.
- `shoot.cjs <setting>`: photographs the built page for one setting.
- `pagecheck.cjs`: the page at phone width and in light mode.
- The briefs the settings were drawn to:
  - `AGENT-BRIEF.md`: the rules and craft, with what the first dungeon
    taught;
  - `COUNTERPART-BRIEF.md`: the other sides. Its dungeon and tower rows are
    superseded: those two stay inside only (AJ7);
  - `NEW-SETTINGS-BRIEF.md`: the eight new settings.
  They name `px.js` and `scenes/` here, which have since moved to the
  package.

The scripts use the Chromium in `.ds-sync` (see `scripts/print-deck.mjs`)
and `scripts/lib/paint.mjs`, which bundles the package for scripts.
