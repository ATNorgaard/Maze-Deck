import { useSoundOn } from '../stage/sound';

/**
 * One switch, remembered per device, off until somebody turns it on.
 * The click is the user gesture that unlocks audio, so turning it on
 * plays a note straight away — a switch that answers is a switch you
 * trust.
 */
export function SoundToggle() {
  const [on, setOn] = useSoundOn();
  return (
    <button
      type="button"
      className="t-btn"
      aria-pressed={on}
      onClick={() => setOn(!on)}
      title="Card and dice sounds, synthesised here. Off by default."
    >
      {on ? 'Sound on' : 'Sound off'}
    </button>
  );
}
