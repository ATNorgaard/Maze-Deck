# The other side: inside and outside for every setting

The author decided (2026-10-11) that **every setting has an inside and an
outside**, chosen when a crossing is set up. The frozen pass already has
both: the open peaks (outside) and the ice cave (inside). Each other setting
has one picked design and needs its counterpart: **the other side of the
same place**.

| Setting | Picked | Its side | Draw |
|---|---|---|---|
| Dungeon | A, the gatehouse | inside | **outside** |
| Tower | A, the stair library | inside | **outside** |
| Deep forest | A, firefly hollow | outside | **inside** |
| Desert | A, salt and sunset | outside | **inside** |
| Undercity | B, the drowned canal | inside | **outside** |

Read AGENT-BRIEF.md again (the same rules: the sizes, the luminance budget,
reserved card colours, speed, the craft), and read the picked design closely.
The counterpart must feel like **the same place seen from its other side**:
the same palette family and light logic, the same materials, motifs that
carry over (the dungeon's portcullis seen from outside; the tower's candles
glimpsed through its windows; the forest's fireflies inside the tree; the
desert's gold light falling into the temple; the canal's teal glow leaking up
through the city's grates). A player who has seen one should recognise the
other.

## What to write

In your setting's file, `docs/art-directions/scenes/<setting>.js`:

- add a third design, **key 'C'**, `id: '<setting>-c'`, with
  `side: 'outside'` or `'inside'` as the table says, and the same fields as
  the others (title, pitch, notes, palette, back, vista with all five
  subjects, world);
- give the **picked** design its `side` too (the opposite one);
- leave the unpicked design alone.

The card back is the same for the whole deck whichever side is played, so
your **back** is a candidate: it should be as good as the picked one, but
the author will choose which back the deck keeps (or keep both, one per
side).

Run `node inspect.cjs <setting>` and `node shoot.cjs <setting>` from
`docs/art-directions`, look at every PNG, and iterate at least four rounds.
Edit only your scene file; never px.js or the page; never commit.

Report back in under 200 words: the design, what you are proudest of, what
is weak, build times and luminance numbers.
