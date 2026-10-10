# The front door: the landing and the threshold

**Status:** a plan, not started. Written 2026-10-10, after the overhaul shipped
(`world/10`). The overhaul turned the board into a place. This plan does the
same for the two screens people see before the board: the **landing**, which
says what Maze Deck is, and the **threshold**, where a GM sets up a crossing.
It also covers the player's own front door, the **join** screen.

The art these screens show (the card backs and each setting's world) is
planned separately, as a set of art jobs, in [art-jobs.md](art-jobs.md). This
plan can ship with today's art and pick up the new art as each job lands.

Everything here follows [DECISIONS.md](DECISIONS.md), and what the overhaul
decided along the way (O1–O8, W1–W9) still holds.

## How the analysis was done

- **Read the three screens.** `LandingScreen.tsx` (192 lines),
  `CampaignScreen.tsx` (431) and `JoinScreen.tsx` (109), and their CSS in
  `app.css`.
- **Photographed them**, whole pages, at 1440 × 900 and at 390 × 844 at 3×,
  with a phone's touch and mobile flags (`proof/front-survey/`).
- **Measured them at rest** on a phone (390 × 844, 4× CPU, software GL), the
  way `measure-frames.cjs` measures the board: main-thread time over four
  seconds, and frames over 33 ms.
- **Counted the work:** the length of each page in phone screens, where the
  decisions sit on it, inputs and tab stops, and text contrast against the
  page.
- **Checked the claims:** the landing's copy against how the game now works,
  and the threshold's numbers against what the engine does with them.

## The flow, as it plays today

| # | Moment | What the screen does | What it feels like |
|---|---|---|---|
| 1 | Arrive | A kicker, a title (*The dungeon you never have to map*), a paragraph, two buttons | A good book jacket |
| 2 | Read on | *What it is for* (two paragraphs), *A turn, start to finish* (three text cards), five card faces, *What to expect* (six notes), a footer | A well-written manual |
| 3 | Set up a crossing | The threshold: the crossing's name over a fret pattern, *Start the crossing* and *Host online*, then the doors, four sample cards, the party sheet, the dials, *Who rolls?* | A settings page that is trying to be a stage |
| 4 | Choose a setting | A strip of six door tiles. The chosen one lights; the page takes its palette; with sound on, its bed plays (phase 9) | Picking a swatch |
| 5 | Gather the party | One ruled line per seat: name, class, six modifier boxes | A spreadsheet |
| 6 | Set the dials | Four steppers, a live count of the deck, a footnote on which dial matters | Reading the fine print |
| 7 | Start | *Start the crossing* (the opening plays) or *Host online* (a code appears on the board) | The cut from a form to a place |
| 8 | A player joins | *The code*: one field and *Join*, then a list of seats | A login form |

The board, since the overhaul, is a place. Every screen before it is a page.

## What the analysis found

### 1. The front door is the one part of the game that is not the game

Since the overhaul, the board has the setting full-bleed behind it, a
picture for every scene, a route, the dark closing in, cards with weight, an
opening, a storyboard and a bed of sound. None of that reaches the landing
or the threshold:
- there is no world layer on either (`.t-world` is absent);
- the landing never shows a card turning, the one moment the game is built
  around. Its five cards are static faces;
- the threshold shows the chosen setting as a tile and four static cards.

A newcomer reads that the game is atmospheric, then has to set up a crossing
before seeing any of it.

### 2. The landing describes what it could show

The copy is good: clear, honest, and funny in places. But a turn, the thing a
visitor most needs to understand, is three text boxes (*Act*, *Commit*,
*Live with it*). The page is 2.5 screens long on a laptop and **4.2 on a
phone**, and its first moving thing is the background. The game's whole pitch
is "act first, find out second". The page could let a visitor do exactly
that in thirty seconds, with the real components and the real engine, before
they read a word of explanation.

### 3. The front door still pays for the old background

The landing and the threshold still run the old animated ground (`tDrift`,
the SMIL grounds), which the overhaul's phase 3 retired from the board. At
rest on a phone, at 4× CPU:

| Screen | Main-thread time, 4 s at rest |
|---|---|
| Landing | 0.62–0.68 s |
| Threshold | 0.84–0.89 s |
| The board (`world/10`, world drawn still) | 0.20 s |
| A player's phone screen (`world/10`) | 0.24 s |

The front door is now the most expensive part of the app to leave open, and
the cost buys a slowly drifting gradient.

### 4. The threshold asks for everything at once, in the wrong order

- **34 inputs and 62 tab stops** on one page, for a GM who usually changes
  one thing: the setting.
- **On a phone it is 3.2 screens long.** The party starts 1.6 screens down,
  below the doors and four sample cards that fill a whole screen between
  them.
- **The decisions come after the button that depends on them.** *Start the
  crossing* sits at the top, above the setting, the party and the dials. The
  defaults make that safe, but the page reads as "start now, configure
  later".
- **On a phone the top bar wraps** into two rows of four buttons, so *Start
  the crossing* appears twice above the fold, and *Host online* twice too.
- **The title can be edited, and nothing says so.** The crossing's name is an
  input styled as a heading. Its one cue is an underline on hover, which a
  touch screen never shows.

### 5. The setting is chosen from postage stamps

Choosing a door is the threshold's best idea: the setting is the biggest
choice a GM makes, and the page puts on its palette. But each door is a
small static tile of the card back, faded. The chosen setting never fills
the screen, as it will the moment the crossing starts. The four sample cards
under the strip repeat the door at four times its size and push everything
else down.

### 6. The party is a spreadsheet, and its numbers mislead

One row per seat, with six modifier boxes, works on a laptop and is
cramped on a phone. Two things are worth fixing beyond the look:
- **The rows are numbered 1–4 in circles**, the same tokens the board's rail
  uses for the order of play. But the engine shuffles initiative when a
  crossing starts (R7, `createGame`), so the threshold's numbers are not the
  order anyone will play in.
- **A character is a name and six numbers.** The board and the storyboard
  show seats as tokens. Nothing on the threshold looks like the people who
  will be crossing.

### 7. The dials explain themselves in footnotes

*Maze DC*, *Clear Paths to win*, *Extra Clear Paths* and *Extra Monsters*
are honest steppers with a live deck count. What a GM wants to know is what
the dials will do to the evening. The only guidance is a footnote ("The
Monsters are the dial that actually bites"). `packages/rules` already has a
simulator that reports exactly that for any set of dials: rounds played and
encounters met ([reference/balance.md](reference/balance.md)). A forecast
could replace the footnote: *about four rounds; found about once*.

### 8. A player's first sight of the game is a form

The join screen is one field and *Join* on an empty page. Even from a join
link, with the code already filled in, the player presses *Join* before
seeing anything of the room: not the crossing's name, not the setting. Then
comes a plain list of seats. The crossing's name and setting are public to
everyone at the table; showing them would make a phone feel like a window
from its first second, as phase 8 made it once seated.

### 9. Smaller things found on the way

- **Two of the landing's promises are no longer true.** *A room lives only
  while you are playing in it* and *Nothing leaves the browser* predate the
  move to Vercel + Supabase (2026-09-21). A hosted room is a row in a
  database, kept until the sweeper runs ([DEPLOY.md](DEPLOY.md)), and it holds
  the crossing and the seats' names. This should be fixed whatever else is
  done.
- **Naming drifts:** *Set up a crossing*, *Start the crossing* and *New
  crossing*; *Join with a code* and *Join a maze*.
- **The way back is hidden.** From the threshold, the landing is reached
  only by the brand mark.
- **The threshold's hero wears the old fret pattern** (`MazeField`), not the
  setting's new art.
- **Contrast is sound.** The only text under 4.5:1 against the page is
  decorative (step numerals, separator dots).

## The direction

Four ideas, each traceable to a finding:

1. **Arrive in the place.** The landing opens on a living setting: the world
   layer behind it and a vista in front, walking slowly through the six
   settings, with the deck lying on the table. The threshold wears the
   chosen setting full-bleed, the way the board will. (1, 3, 5)
2. **Show a turn, don't describe it.** Three cards on the landing. Spend an
   action, commit to a path, watch it turn: the real components, the real
   reveal, a real scene, from a sandboxed crossing on a fixed seed. The
   explanation follows for those who want it. (2)
3. **The threshold is a ritual: choose a door, gather the party, set the
   dials, open the door.** In that order, top to bottom, with the start
   button at the end where its decisions are. One page on a laptop; on a
   phone, the same four steps one screen each. (4, 5, 6)
4. **Forecast, don't footnote.** The dials say what they will do, from the
   simulator, as they move. (7)

And for players: **the join screen shows the room before the code is
checked**, its name and its setting. (8)

One engineering idea runs under it: **the front door uses the board's
machinery.** The world layer at the device's tier, the vista and art from
`packages/art`, the stage's cards, the bed. Nothing new to keep alive, and the
SMIL grounds go.

### The new landing

```
┌────────────────────────────────────────────────────────────────────────┐
│ ◠ MAZE DECK                                   Join with a code  Set up │  thin bar
│                                                                        │
│   the world layer, full-bleed: the setting breathing behind everything │
│   ╭──────────────────── a vista, walking the six settings ──────────╮  │
│   │   dungeon → tower → forest → desert → undercity → pass, slowly    │  │
│   ╰──────────────────────────────────────────────────────────────────╯  │
│              THE DUNGEON YOU NEVER HAVE TO MAP                          │
│        Three paths. One action. Then you commit. [ Set up a crossing ]  │
│                                                                        │
│      ┌──────┐  ┌──────┐  ┌──────┐     try it: spend an action,         │
│      │  ◠   │  │  ◠   │  │  ◠   │     then take a path.                │  a turn you play
│      └──────┘  └──────┘  └──────┘     ( Careful thought ) ( Steel )    │
│                                                                        │
│   What it is for · A turn, start to finish · What to expect            │  the copy, kept,
│   (the existing writing, tightened, below the fold)                    │  as reading
└────────────────────────────────────────────────────────────────────────┘
```

### The new threshold

```
┌────────────────────────────────────────────────────────────────────────┐
│ ◠ MAZE DECK · Campaign: The Long Road               Scenario tables  ⋯  │
│                                                                        │
│   the chosen setting full-bleed: its world, its vista, its bed         │
│   ① CHOOSE A DOOR   ▢ ▢ [▣] ▢ ▢ ▢   the doors as large cards, new backs │
│      Wet stone, three corridors, and no map.                           │
│                                                                        │
│   ② GATHER THE PARTY  ┌Brakka┐ ┌Wren ┐ ┌Odalis┐ ┌Sable┐ ┌ + ┐           │  character cards,
│                       │Ftr +3│ │Rog +4│ │Clr +4│ │Wiz +4│                │  tap to edit
│                                                                        │
│   ③ SET THE DIALS     DC 15 · 5 to win · +0 · +0                       │
│      ≈ 4 rounds, about a quarter of an hour · found about once          │  the forecast
│      Who rolls: the app ▣  the players ▢                                │
│                                                                        │
│   ④ THE ASHEN TOWER ✎        [ Open the door ]   Host online           │  the start, last
└────────────────────────────────────────────────────────────────────────┘
```

## Phases

Each phase ends with something that runs, gets one commit (`door/N`), and is
judged by a script before anyone's eyes.

| # | Phase | Size | Needs | Status |
|---|---|---|---|---|
| 0 | Measure and fix: a `capture-front.cjs`; the SMIL grounds go; the landing's two untrue promises; naming; the phone's top bar | S | — | next |
| 1 | Arrive in the place: the landing's world and walking vista | M | 0 | |
| 2 | A turn you can play, on the landing | M | 1, F1 | |
| 3 | Choose a door: the threshold wears its setting; doors as large cards | M | 0 | |
| 4 | Gather the party: character cards, and no false order | M | 3 | |
| 5 | The dials forecast: the simulator, in a worker | M | 3, F3 | |
| 6 | The player's front door: the room before the code | S | 0, F4 | |
| 7 | Retire and record | S | all | |

### 0. Measure and fix

- **`scripts/capture-front.cjs`.** It photographs the landing, the threshold
  and the join screen at 1440 × 900, 1366 × 657 and 390 × 844. It measures
  each at rest (as the survey above did), and checks the page length in
  screens, where the decisions sit, and contrast. Every later phase is held
  to it.
- **The front door uses the world layer, not the SMIL grounds:** the same
  `World`, at the device's tier and calm mood, behind the landing and the
  threshold. With that, the old grounds have no screen left to serve, and
  they can go, except as the world's *Off* choice (which keeps a still
  picture).
- **The landing says what is true.** Rooms are kept as rows until they are
  swept, and they hold the crossing and the seats' names. Characters live in
  the GM's browser, and a player's identity in theirs.
- **One name for each thing:** *Set up a crossing* to reach the threshold,
  *Open the door* (or *Start the crossing*, F2) to begin, *Join with a code*
  everywhere.
- **The phone's top bar is one row:** the brand, *Join*, and a menu. The
  start button lives where its decisions are (phase 3).

### 1. Arrive in the place

- **The landing's background is the world layer**, walking through the six
  settings: every ~12 s the palette, particles and edge cross-fade to the
  next, at calm mood. Reduced motion shows one still setting.
- **A vista under the title**, from `packages/art`, keyed to the same walk:
  each setting's own scene, with the arch in it.
- **The five card faces lie on a table,** with phase 6's tilt and sheen.
- **The copy stays and is tightened**, below the fold, as reading for those
  who want it. *What to expect* answers questions people ask, and keeps its
  place.
- **Budget:** at rest it costs no more than the board does (≤ 0.25 s of main
  thread per 4 s on a phone), measured by `capture-front.cjs`.

### 2. A turn you can play

- **Three face-down cards and two actions,** from a sandboxed `LocalSession`
  on a fixed seed, so every visitor's first turn is a good one. *Careful
  Consideration* turns two of the paths and lets the visitor throw one away,
  which is information bought with an action. *Steel Yourself* sweeps the
  river and deals three fresh. Then the commit turns a card, and its scene
  appears with its picture. A second try deals the next seed.
- **The real stage:** the deal, the lift, the flip, the signature, the
  caption and the bed (if sound is on). Nothing is a video or a recording.
- **One line under it** says what just happened in the game's terms: "You
  spent an action, saw two paths and threw one away. Then you committed, and
  it held. Five of those and the party is through."
- **No accounts, no saving:** the sandbox leaves nothing in storage.

### 3. Choose a door

- **The doors are cards at a size you can read:** the setting's back, its
  name, its flavour line. The chosen door lifts like a picked path.
- **The threshold wears the chosen setting:** its world full-bleed, its
  vista behind the doors, and its bed if sound is on. Choosing another door
  cross-fades all three. The four sample cards fold into the chosen door, so
  turning it shows the faces in this setting's words.
- **The order is the ritual:** door, party, dials, start, top to bottom. The
  crossing's name moves to the last step, beside the button that opens it,
  with a visible edit mark.
- **On a phone each step is a screen.** The steps are sections a GM can
  scroll through, and *Open the door* stays reachable at the foot.

### 4. Gather the party

- **Each seat is a card:** name, class, the six modifiers in a compact strip,
  and the ability the party leans on picked out. Tap a card to edit it in
  place. Adding a seat is a blank card.
- **No numbers that imply an order.** The cards are unnumbered, and one line
  says initiative is rolled when the door opens.
- **On a phone,** two cards to a row, with editing in a sheet like the
  phone's hand.

### 5. The dials forecast

- **The simulator runs in a worker** as the dials move: a few hundred seeded
  runs per change, which take well under a second. It reports rounds, a
  rough length in minutes, and encounters.
- **The forecast replaces the footnote:** *About 4 rounds, a quarter of an
  hour. Found about once.* Moving a dial shows the change as it happens.
- **Presets** for the common cases: *A quick scene*, *As written*, *A long
  road*, *Hunted*.
- **What it does not show is F3.** As written, the card game cannot be lost
  ([balance.md](reference/balance.md)), so a "chance of getting through" would
  read 100% at every setting. That is a fact about the rules, not the
  forecast, and showing it is the author's call.

### 6. The player's front door

- **A join link shows the room before the code is checked:** the crossing's
  name and its setting, with its back and its world behind, and then the
  seats as cards with the names on them. The code is still the only key.
- **A small server change and no migration:** the authority's seat offers
  (`join` without a seat) also carry the crossing's name and setting, which
  every seated player already sees. A wrong code still answers *No session
  with that code*, and reveals nothing.
- **The extra tap goes:** a join link with a valid code goes straight to the
  seats.

### 7. Retire and record

- The old landing and threshold CSS goes. Re-measure with `capture-front.cjs`.
- Add to DECISIONS.md what was decided along the way. Rewrite STATUS.md.

## Decisions for the author

| # | Question | Recommended |
|---|---|---|
| F1 | Does the landing let a visitor play a turn, on a sandboxed crossing with a fixed seed? | **Yes.** It is the shortest honest explanation of the game, and it uses only what exists. |
| F2 | What is the start button called: *Open the door* or *Start the crossing*? | ***Open the door*** on the threshold, matching the doors and the arch on every card. The board and the docs keep *crossing*. |
| F3 | Does the forecast show the chance of getting through, which is 100% as the rules stand? | **Not yet.** Show length and encounters. Revisit with D8 (a cost for failure), which would make the number mean something. |
| F4 | May a join link show the crossing's name and setting before a seat is taken? | **Yes.** Everyone holding the code sees them a moment later anyway, and a wrong code still reveals nothing. |
| F5 | Does the threshold become steps on every size, or a single page with steps only on a phone? | **One page with numbered sections on a laptop, a screen per step on a phone.** A GM who only changes the setting should not click through three steps to do it. |
| F6 | Which art direction from [art-jobs.md](art-jobs.md) does the front door wear? | **Decided there: A, pixel diorama** (AJ1, 2026-10-10). Both screens take it as each job lands; the threshold's doors already wear the pixel backs (`art/0`). |

## Constraints held throughout

- Everything the overhaul held: transforms and opacity only on the DOM;
  reduced motion respected everywhere, and any beat skippable; the card face,
  the print deck, the canonical names and the colour families untouched; no
  art that is not ours (A7).
- **The front door costs no more at rest than the board,** measured.
- **Nothing on the front door needs an account or saves anything** it does
  not save today.
- **The landing works without JavaScript's heavy parts:** the copy and the
  two buttons render before the world layer or the demo load, and a device
  that cannot draw WebGL gets the still tier.
- **Every number on the page comes from the code** (the deck, the dials, the
  forecast), as the landing's copy already does, so the page cannot drift
  from the game.
- One commit per phase, `door/N`. STATUS.md names the next action.

**Not doing:** accounts, saved campaigns in the cloud, a marketing site
separate from the app, video, or analytics.

## Log

Nothing yet.
