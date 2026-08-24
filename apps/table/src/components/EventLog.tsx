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
  /** A player's screen never receives the gm-only lines at all. */
  asGm: boolean;
}

export function EventLog({ log, asGm }: Props) {
  const visible = log.filter((e) => asGm || e.visibility === 'all');

  // Players are numbered sequentially over what they can actually see.
  // Showing the engine's own numbering would leave gaps, and a gap tells
  // a player exactly how much is being kept from them.
  const numbered = visible.map((e, i) => ({ e, n: asGm ? e.n : i + 1 }));

  return (
    <div className="t-panel">
      <h2 className="t-panel__title">The log</h2>
      <div className="t-log">
        {numbered.length === 0
          ? <p className="t-note">Nothing has happened yet.</p>
          : [...numbered].reverse().map(({ e, n }) => (
              <p className="t-log__line" key={e.n}>
                <span className="t-log__n">{String(n).padStart(2, '0')}</span>
                <span style={{ color: COLOUR[e.kind] }}>
                  {e.visibility === 'gm' ? <span className="t-log__gm">GM</span> : null}
                  {e.text}
                </span>
              </p>
            ))}
      </div>
    </div>
  );
}
