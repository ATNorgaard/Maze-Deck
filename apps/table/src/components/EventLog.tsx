import type { GameEvent } from '@maze-deck/rules';

const COLOUR: Record<GameEvent['kind'], string> = {
  good: 'var(--md-cat-path-300)',
  bad: 'var(--md-cat-mons-300)',
  card: 'var(--md-parchment-200)',
  muted: 'var(--md-ink-500)',
  sys: 'var(--md-parchment-400)',
};

interface Props {
  log: GameEvent[];
}

/**
 * Every line is public now: the picked card is named to the table and
 * the deck peeks are shared aloud. `visibility` stays on the event for
 * M3's GM-only scenario prompts and for M4, where a player's payload
 * still has to have face-down river cards stripped from it.
 */
export function EventLog({ log }: Props) {
  const numbered = log
    .filter((e) => e.visibility === 'all')
    .map((e, i) => ({ e, n: i + 1 }));

  return (
    <div className="t-panel t-panel--log">
      <h2 className="t-panel__title">The log</h2>
      <div className="t-log">
        {numbered.length === 0
          ? <p className="t-note">Nothing has happened yet.</p>
          : [...numbered].reverse().map(({ e, n }) => (
              <p className="t-log__line" key={e.n}>
                <span className="t-log__n">{String(n).padStart(2, '0')}</span>
                <span style={{ color: COLOUR[e.kind] }}>{e.text}</span>
              </p>
            ))}
      </div>
    </div>
  );
}
