import {
  ABILITIES, ArchGlyph, CANONICAL_CATEGORIES, DECK_TOTAL, DeckCard,
  ENCOUNTER_AT, ESCAPE_TARGET, MAZE_DC, RIVER_WIDTH,
} from '@maze-deck/ui';

interface Props {
  onStart: () => void;
  onJoin: () => void;
  /** Present only when this browser has a crossing part-way through. */
  onResume?: (() => void) | undefined;
}

/** Numbers come from the deck definition so this page cannot drift from it. */
const TURN = [
  {
    glyph: 'scout-ahead' as const,
    title: 'Act',
    body: `One of ${ABILITIES.length} actions, each a check against the Maze DC — `
      + `${MAZE_DC} by default. They buy information, thin the danger, or bend `
      + `what is coming. Spend it before you know anything.`,
  },
  {
    glyph: 'clear-path' as const,
    title: 'Commit',
    body: `Then, and only then, take one of the ${RIVER_WIDTH} paths in front of `
      + 'you. The card turns over. This is the order that matters: you act first '
      + 'and find out second, which is what stops a party inching forward.',
  },
  {
    glyph: 'monster' as const,
    title: 'Live with it',
    body: `${ESCAPE_TARGET} Clear Paths and the party is through. `
      + `${ENCOUNTER_AT} Monsters and something has found them — at which point `
      + 'the app steps back and hands the scene to your table.',
  },
];

const EXPECT = [
  {
    title: 'The GM needs a screen',
    body: 'A laptop or tablet. The board wants width — it deals the cards, holds '
      + 'the log, and is the only place a roll can be overruled.',
  },
  {
    title: 'Players need nothing',
    body: 'A six-character code, typed into a phone. No download, no account, no '
      + 'setup. Their character lives in their own browser and comes back next time.',
  },
  {
    title: 'It will not run your combat',
    body: 'When the party is found, the app pauses and waits. You roll initiative '
      + 'and fight it at the table like always, then tell it who won.',
  },
  {
    title: 'It brings its own prompts',
    body: 'Every card drawn hands the GM a scenario to narrate, from tables you '
      + 'can rewrite. Nobody has to invent a corridor on the spot.',
  },
  {
    title: 'A crossing is short',
    body: 'Four rounds or so — roughly quarter of an hour. It is a scene inside '
      + 'your session, not an evening of its own.',
  },
  {
    title: 'Nothing leaves the browser',
    body: 'No sign-up and no profile. A room lives only while you are playing in '
      + 'it, and anyone holding the code can take a seat.',
  },
];

export function LandingScreen({ onStart, onJoin, onResume }: Props) {
  return (
    <>
      <div className="t-bar">
        <span className="t-brand">
          <span className="t-brand__glyph"><ArchGlyph state="seal" /></span>
          Maze Deck
        </span>
        <span className="t-spacer" />
        <span className="t-bar__group">
          {onResume ? (
            <button type="button" className="t-btn" onClick={onResume}>
              Back to the run
            </button>
          ) : null}
          <button type="button" className="t-btn" onClick={onJoin}>
            Join with a code
          </button>
          <button type="button" className="t-btn t-btn--primary" onClick={onStart}>
            Set up a crossing
          </button>
        </span>
      </div>

      <div className="t-land">

        <header className="t-land__hero">
          <p className="t-kicker">A card system for tabletop travel</p>
          <h1 className="t-land__title">The dungeon you never have to map</h1>
          <p className="t-land__lede">
            Maze Deck replaces square-by-square dungeon mapping with a deck of
            cards. The party sees three paths, spends one action, and commits to
            one of them. It runs <em>alongside</em> the game you are already
            playing — the GM keeps the board, everyone else joins from a phone.
          </p>
          <div className="t-land__doors">
            <button type="button" className="t-btn t-btn--primary" onClick={onStart}>
              Set up a crossing
            </button>
            <button type="button" className="t-btn" onClick={onJoin}>
              Join with a code
            </button>
          </div>
          <p className="t-land__fine">
            Free. No account, nothing to install, works on a phone.
          </p>
        </header>

        <section className="t-land__band">
          <h2 className="t-land__h2">What it is for</h2>
          <p className="t-land__prose">
            Mapping a dungeon room by room is where a session goes to die. Someone
            draws graph paper, someone else taps every flagstone with a ten-foot
            pole, and an hour disappears into a corridor. The caution is rational —
            careful play <em>is</em> safer — which is exactly why asking people to
            stop never works.
          </p>
          <p className="t-land__prose">
            So the deck removes the reward instead. Information has a price, the
            threat behind you accumulates whether you move or not, and the only way
            to learn what a path holds is to take it. Nobody has to be told to
            hurry.
          </p>
        </section>

        <section className="t-land__band">
          <h2 className="t-land__h2">A turn, start to finish</h2>
          <ol className="t-land__steps">
            {TURN.map((step, i) => (
              <li key={step.title} className="t-land__step">
                <span className="t-land__stepGlyph"><ArchGlyph state={step.glyph} /></span>
                <span className="t-land__stepNum">{i + 1}</span>
                <h3 className="t-land__h3">{step.title}</h3>
                <p className="t-land__prose">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="t-land__band">
          <h2 className="t-land__h2">{DECK_TOTAL} cards, five kinds</h2>
          <p className="t-land__prose t-land__prose--wide">
            Every card is the same doorway. Only what stands in it changes.
          </p>
          <div className="t-land__deck">
            {CANONICAL_CATEGORIES.map((c) => (
              <DeckCard key={c.category} category={c.category} size="sm" />
            ))}
          </div>
        </section>

        <section className="t-land__band">
          <h2 className="t-land__h2">What to expect</h2>
          <div className="t-land__grid">
            {EXPECT.map((item) => (
              <div key={item.title} className="t-land__cell">
                <h3 className="t-land__h3">{item.title}</h3>
                <p className="t-land__prose">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="t-land__foot">
          <p className="t-land__prose t-land__prose--wide">
            Maze Deck is a companion to a game you are already running, not a game
            on its own. It handles the travelling. Everything that actually matters
            still happens at your table.
          </p>
          <div className="t-land__doors">
            <button type="button" className="t-btn t-btn--primary" onClick={onStart}>
              Set up a crossing
            </button>
            <button type="button" className="t-btn" onClick={onJoin}>
              Join with a code
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}
