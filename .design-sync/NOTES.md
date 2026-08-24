# design-sync notes — @maze-deck/ui

Repo-specific gotchas. Read this before a re-sync.

## Build

- The package lives at `packages/ui`. There is no workspace root and no
  lockfile at the repo root — run `npm install` inside `packages/ui`.
- `npm run build` is **two** steps: `tsup` (JS + `.d.ts`) then
  `node scripts/build-css.mjs`. Skipping the second leaves `dist/styles.css`
  stale and the sync ships old CSS.
- Converter invocation (no `node_modules/@maze-deck/ui` exists — npm will not
  self-install — hence `--entry`):

  ```
  node .ds-sync/package-build.mjs --config .design-sync/config.json \
    --node-modules packages/ui/node_modules \
    --entry ./packages/ui/dist/index.js --out ./ds-bundle
  ```

## Why cssEntry points at `dist/styles.css`, not `src/styles/index.css`

The converter copies `cssEntry` **verbatim** and does not follow relative
`@import`s. Pointing it at the modular `src/styles/index.css` produced a
507-byte `_ds_bundle.css` importing three files that were never copied —
`[CSS_IMPORT_MISSING]` × 3, and every design would have rendered unstyled.
`scripts/build-css.mjs` flattens the imports into one file; the Google Fonts
`@import` is hoisted to the top because `@import` must precede all rules.
**Do not repoint `cssEntry` at the src entry.**

## `dtsPropsFor` — do not delete

`RiverProps.slots: RiverSlot[]` and `ActionBarProps.abilities?: AbilityKey[]`
extracted as **dangling type references**: the emitted `.d.ts` named types it
never defined. A direct union alias (`CardCategory` on `DeckCard`) inlines
fine; a named type behind an **array** does not. Both are hand-inlined in
`cfg.dtsPropsFor`. If either component's props change, update that config —
the auto-extraction will not.

## Library bugs the previews caught

Both were invisible until a preview showed two states side by side:

- **`size` prop was a no-op on every card.** The size steps were scoped to
  `.md-root[data-size]` only, so `data-size` on a child card never resolved.
  Fixed by adding the descendant selector `.md-root [data-size="…"]`. The
  `CardBack.AcrossScales` and `MazeDeckProvider.SizeSteps` cells exist
  specifically to keep this honest — if all three cards ever look identical
  again, the selector regressed.
- **`River` warning overflowed.** The three-blocker warning was a fourth flex
  item on a non-wrapping row. Adding `flex-wrap` "fixed" it but broke the
  river into 2+1 — the one thing a three-wide river must never do. Correct
  structure is a **column** (`.md-river`) containing a slot **row**
  (`.md-river__slots`) with the warning underneath.

## Preview scope + card presentation

- All 13 components have authored previews in `.design-sync/previews/`.
- `cfg.provider` wraps every preview in `MazeDeckProvider size="md"`. At `sm`
  the ActionBar labels were illegible; at `md` they read.
- Nine components need `cardMode: "column"` — a card design system is wide by
  nature, and the default grid cropped side-by-side stories.
- `DeckCard`, `AbilityCard` and `PrintSheet` also need a taller `viewport`:
  their overview stories are multi-row and the default cell height cropped the
  last row. Overview stories are pinned to explicit
  `gridTemplateColumns: repeat(N, max-content)` so a reflow can never add a
  row the viewport cannot show. The story cell is roughly **500px wide** —
  3 columns of `sm` cards is the practical maximum.
- `PrintSheet` stories nest their own `MazeDeckProvider size="sm"`: an A4
  sheet is 282mm tall at print scale and cannot fit a preview card. The
  layout is the point of that component, not print fidelity.

## Known render warns

- `[FONT_REMOTE] "Iowan Old Style", "Trajan Pro"` — expected. Those are local
  fallbacks in the font stacks, never shipped. Cinzel and Spectral come from
  the Google Fonts `@import` at the top of `styles.css`, declared via
  `cfg.runtimeFontPrefixes`.

## Re-sync risks

- **The fonts are network-fetched.** `styles.css` `@import`s Google Fonts. If
  Claude Design ever blocks that host, every card falls back to Georgia and
  the engraved-capital identity is lost. Vendoring Cinzel + Spectral into
  `fonts/` via `cfg.extraFonts` is the fix if that happens.
- **`--md-u` is a millimetre.** Card geometry is physically correct for print,
  which means screen sizes are a consequence of the print spec, not chosen for
  screens. If the digital surfaces ever need their own scale, add a size step
  rather than changing the base unit — print depends on it.
- **Deck composition is duplicated.** `packages/ui/src/types.ts` holds the
  counts for React; `design-system/tokens.css` holds them for the print sheet.
  They agree today (6/4/4/3/4/4/3 = 28) but nothing enforces it. Changing one
  silently desynchronises the printed deck from the digital one.
- **No version control.** This repo is not a git repo, so the durable
  `.design-sync/` files (config.json, conventions.md, previews/, this file)
  are not committed anywhere. `git init` before the next sync.
- Verified against Node 20.19.0, npm 10.8.2, tsup 8.5.1, playwright chromium.
