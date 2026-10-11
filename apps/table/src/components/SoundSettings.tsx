import * as React from 'react';
import { play, useLevel, useSoundOn } from '../stage/sound';
import type { Level } from '../stage/sound';
import { SoundToggle } from './SoundToggle';

/** One level's slider. The voices answer as it moves, so you hear where you set it. */
function LevelSlider({ level, label, title }: { level: Level; label: string; title: string }) {
  const [value, setValue] = useLevel(level);
  const lastTick = React.useRef(0);
  return (
    <label className="t-level" title={title}>
      <span className="t-level__name">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        aria-valuetext={`${Math.round(value * 100)}%`}
        onChange={(e) => {
          setValue(Number(e.target.value) / 100);
          const now = performance.now();
          if (level === 'voices' && now - lastTick.current > 150) { lastTick.current = now; play('tick'); }
        }}
      />
      <span className="t-level__value">{Math.round(value * 100)}%</span>
    </label>
  );
}

/**
 * The sound, for this device: the switch, and while it is on, how loud
 * the setting's air and the cards and dice each are. Remembered here.
 */
export function SoundSettings() {
  const [on] = useSoundOn();
  return (
    <div className="t-sound">
      <SoundToggle />
      {on ? (
        <>
          <LevelSlider level="bed" label="Ambience" title="The setting’s air under the table: wind, water, the room." />
          <LevelSlider level="voices" label="Effects" title="The cards, the dice and the moments the table plays." />
        </>
      ) : null}
    </div>
  );
}
