import * as React from 'react';
import { FALLBACK_PALETTE, SceneArt, readPalette, vocabOf } from '@maze-deck/art';
import type { BiomeVocab, Palette } from '@maze-deck/art';
import type { GameView } from '@maze-deck/rules';
import { getCategory } from '@maze-deck/ui';
import type { Biome } from '../biomes';
import type { ChronicleEntry } from '../campaign';
import { fightLine, fightsPhrase, recap, tell } from '../story';

interface Props {
  view: GameView;
  biome: Biome;
  runName: string;
  /** Every scene drawn this crossing; empty on a player's preview. */
  scenes: ChronicleEntry[];
  onExit: () => void;
}

/** A scene's picture, as the vista drew it: seeded by the entry, lit by its card. */
const Thumb = React.memo(
  ({ entry, biome, pal, vocab }: { entry: ChronicleEntry; biome: Biome; pal: Palette; vocab: BiomeVocab }) => {
    const id = `story${React.useId().replace(/:/g, '')}`;
    return (
      <SceneArt
        id={id}
        pal={pal}
        vocab={vocab}
        p={{
          category: entry.category, frame: 'vista', aspect: 1.8, seed: `${biome.id}:${entry.entryId}`,
          style: 'flat', px: 2, relief: 1, haze: 0.6, band: false, subject: true, fade: 0,
        }}
      />
    );
  },
  (a, b) => a.entry.key === b.entry.key && a.biome.id === b.biome.id && a.pal === b.pal,
);
Thumb.displayName = 'Thumb';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The end of a crossing, told back (docs/overhaul.md, phase 7).
 *
 * Feel/8's ending plays first — the river fans open or the light goes
 * out — and then this: how it ended, and every scene the GM read out,
 * round by round, each with the picture the table saw, who took the
 * path, and what came of it when a Monster found them. The GM can read
 * it back, copy it as text to keep for next session, or go back to the
 * campaign. A player's preview has no scenes to tell: they are the GM's.
 */
export function Storyboard({ view, biome, runName, scenes, onExit }: Props) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pal, setPal] = React.useState<Palette>(FALLBACK_PALETTE);
  React.useLayoutEffect(() => {
    if (ref.current) setPal(readPalette(ref.current));
  }, [biome.id]);
  const vocab = vocabOf(biome.id);

  const story = React.useMemo(() => tell(scenes, view), [scenes, view]);
  const through = view.outcome === 'through';
  const title = through ? 'The party is through' : 'The run is closed';
  const ending = through
    ? `${plural(view.progress, 'Clear Path', 'Clear Paths')} in ${plural(view.round, 'round', 'rounds')}; ${fightsPhrase(story.fights)}.`
    : `${view.progress} of ${view.rules.escapeTarget} Clear Paths, closed in round ${view.round}; ${fightsPhrase(story.fights)}.`;
  const next = through
    ? 'Start the scene on the far side.'
    : 'Note where they got to, and pick it up from there.';
  const cardName = (c: ChronicleEntry['category']) => biome.cards?.[c]?.title ?? getCategory(c).title;

  const [copied, setCopied] = React.useState<'idle' | 'done' | 'failed'>('idle');
  const copy = async () => {
    const text = recap(story, { runName, setting: biome.name, ending: `${title}. ${ending}` }, cardName);
    try {
      await navigator.clipboard.writeText(text);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
    window.setTimeout(() => setCopied('idle'), 2400);
  };

  return (
    <div className="t-story" ref={ref} data-outcome={view.outcome ?? undefined}>
      <header className="t-story__head">
        <p className="t-kicker">{runName} · {biome.name}</p>
        <h2 className="t-story__title">{title}</h2>
        <p className="t-story__sum">{ending}</p>
        <p className="t-note">{next}</p>
        <div className="t-story__go">
          {story.rounds.length ? (
            <button type="button" className="t-btn" onClick={() => { void copy(); }}>
              {copied === 'done' ? 'Copied' : copied === 'failed' ? 'Could not copy' : 'Copy the recap'}
            </button>
          ) : null}
          <button type="button" className="t-btn t-btn--primary" autoFocus onClick={onExit}>
            Back to the campaign
          </button>
        </div>
        <p className="t-sr" role="status">{copied === 'done' ? 'The recap is copied.' : ''}</p>
      </header>

      {story.rounds.length ? (
        <ol className="t-story__rounds">
          {story.rounds.map((r) => (
            <li className="t-story__round" key={r.round}>
              <h3 className="t-story__roundTitle">Round {r.round}</h3>
              <ol className="t-story__scenes">
                {r.scenes.map((s) => (
                  <li className="t-story__scene" key={s.entry.key} data-category={s.entry.category} data-fight={s.fight ?? undefined}>
                    <div className="t-story__pic" aria-hidden="true">
                      <Thumb entry={s.entry} biome={biome} pal={pal} vocab={vocab} />
                    </div>
                    <p className="t-kicker t-story__card">{cardName(s.entry.category)}</p>
                    <p className="t-story__text">{s.entry.text}</p>
                    <p className="t-story__who">
                      {s.who ? `${s.who}, the ${s.path} path` : `The ${s.path} path`}
                    </p>
                    {s.fight ? <p className="t-story__fight">{fightLine(s.fight)}</p> : null}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      ) : (
        <p className="t-note t-story__empty">
          {view.viewer.role === 'gm'
            ? 'No scenes were drawn this crossing.'
            : 'The scenes are the GM’s to tell.'}
        </p>
      )}
    </div>
  );
}
