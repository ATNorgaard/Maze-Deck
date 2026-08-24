import { ArchGlyph } from '@maze-deck/ui';
import { isJoinCode, normaliseJoinCode } from '@maze-deck/rules';
import type { SeatOffer } from '@maze-deck/rules';

interface Props {
  code: string;
  onCodeChange: (code: string) => void;
  /** Sent once a code is entered; null until the server answers. */
  seats: SeatOffer[] | null;
  connected: boolean;
  error: string | null;
  onConnect: () => void;
  onClaim: (seatId: string) => void;
  onBack: () => void;
}

export function JoinScreen({
  code, onCodeChange, seats, connected, error, onConnect, onClaim, onBack,
}: Props) {
  const valid = isJoinCode(code);

  return (
    <>
      <div className="t-bar">
        <span className="t-brand">
          <span className="t-brand__glyph"><ArchGlyph state="seal" /></span>
          Join a maze
        </span>
        <span className="t-spacer" />
        <button type="button" className="t-btn" onClick={onBack}>Back</button>
      </div>

      <div className="t-narrow">
        {seats === null ? (
          <div className="t-panel">
            <h2 className="t-panel__title">The code</h2>
            <p className="t-note">
              Six characters, from your GM. There is no I, O, zero or one in
              them, so nothing is ambiguous read aloud.
            </p>
            <div className="t-row" style={{ marginTop: 'calc(4 * var(--md-u))' }}>
              <input
                className="t-input t-code"
                value={code}
                autoFocus
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                aria-label="Join code"
                placeholder="ABC234"
                onChange={(e) => onCodeChange(normaliseJoinCode(e.target.value))}
                onKeyDown={(e) => { if (e.key === 'Enter' && valid) onConnect(); }}
              />
            </div>
            <div className="t-row t-row--centre" style={{ marginTop: 'calc(4 * var(--md-u))' }}>
              <button
                type="button"
                className="t-btn t-btn--primary"
                disabled={!valid}
                onClick={onConnect}
              >
                {connected ? 'Looking…' : 'Join'}
              </button>
            </div>
            {error ? (
              <p className="t-note" style={{ marginTop: 'calc(3 * var(--md-u))', color: 'var(--md-cat-mons-300)' }}>
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="t-panel">
            <h2 className="t-panel__title">Which one are you?</h2>
            <p className="t-note">
              Pick your character. A seat somebody else is already using is
              greyed out.
            </p>
            <div className="t-seatpick">
              {seats.length === 0 ? (
                <p className="t-note">
                  Nobody has started a crossing in this room yet. Wait for your GM.
                </p>
              ) : seats.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="t-seatpick__btn"
                  disabled={s.taken}
                  onClick={() => onClaim(s.id)}
                >
                  <span className="t-seatpick__name">{s.name}</span>
                  <span className="t-seatpick__cls">
                    {s.taken ? 'taken' : s.cls || 'unlisted'}
                  </span>
                </button>
              ))}
            </div>
            {error ? (
              <p className="t-note" style={{ marginTop: 'calc(3 * var(--md-u))', color: 'var(--md-cat-mons-300)' }}>
                {error}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
