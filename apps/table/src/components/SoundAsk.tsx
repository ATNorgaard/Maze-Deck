import { useSoundChosen, useSoundOn } from '../stage/sound';

/**
 * The threshold asks once (DECISIONS O6): sound stays off by default,
 * but a table that never finds the switch never hears the setting's
 * air. Either answer is kept, and the question does not come back; the
 * switch is in the GM drawer from then on. Saying yes is the gesture
 * that unlocks audio, so the chosen door's bed starts at once.
 */
export function SoundAsk() {
  const chosen = useSoundChosen();
  const [, setOn] = useSoundOn();
  if (chosen) return null;
  return (
    <aside className="t-soundask" aria-label="Sound">
      <p className="t-soundask__title">Play with sound?</p>
      <p className="t-note">
        The setting’s air under the table, and the cards and dice. Quiet, and
        made here: nothing to download.
      </p>
      <div className="t-row t-row--centre">
        <button type="button" className="t-btn t-btn--primary" onClick={() => setOn(true)}>Sound on</button>
        <button type="button" className="t-btn" onClick={() => setOn(false)}>Not now</button>
      </div>
      <p className="t-note t-soundask__after">Either way, the switch is in the GM drawer.</p>
    </aside>
  );
}
