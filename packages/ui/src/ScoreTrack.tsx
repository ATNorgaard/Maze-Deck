import * as React from 'react';
import { ENCOUNTER_AT, ESCAPE_TARGET } from './types';

export interface ScoreTrackProps {
  /** How many pips are filled. */
  value: number;
  /** How many pips there are. Defaults to 5 for progress, 2 for threat. */
  total?: number;
  /**
   * `progress` counts Clear Paths toward escape;
   * `threat` counts revealed Monsters toward a confrontation.
   * @default "progress"
   */
  variant?: 'progress' | 'threat';
  /** Caption to the left of the pips. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The win/loss track, as discrete pips.
 *
 * Deliberately not a percentage bar: the party needs to see how
 * many Clear Paths are LEFT, and two Monsters is a countdown
 * rather than a proportion. Five pips and two pips are both
 * legible at a glance across a table; a bar is not.
 */
export function ScoreTrack({
  value,
  total,
  variant = 'progress',
  label,
  className,
  style,
}: ScoreTrackProps) {
  const count = total ?? (variant === 'progress' ? ESCAPE_TARGET : ENCOUNTER_AT);
  const caption = label ?? (variant === 'progress' ? 'Escape' : 'Threat');

  return (
    <div
      className={[
        'md-score',
        variant === 'threat' ? 'md-score--threat' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={count}
      aria-label={`${caption}: ${value} of ${count}`}
    >
      <p className="md-score__label">{caption}</p>
      <div className="md-score__pips">
        {Array.from({ length: count }, (_, i) => (
          <span className="md-score__pip" key={i} data-filled={i < value || undefined} />
        ))}
      </div>
    </div>
  );
}
