import * as React from 'react';

export interface PlayerSeatProps {
  /** Character or player name. */
  name: string;
  /**
   * Initiative position. Initiative doubles as navigation order
   * AND combat order, so the number is identity rather than
   * decoration — when a Monster turns up, the same order carries
   * straight into the fight without a re-roll.
   */
  order: number;
  /** Whose turn it is now. */
  active?: boolean;
  /** Secondary line — class, ability spread, whatever the table needs. */
  detail?: string;
  /** Called when the seat is chosen. */
  onSelect?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * One seat in the initiative order.
 */
export function PlayerSeat({
  name,
  order,
  active = false,
  detail,
  onSelect,
  className,
  style,
}: PlayerSeatProps) {
  const interactive = Boolean(onSelect);
  return (
    <div
      className={['md-seat', className].filter(Boolean).join(' ')}
      data-active={active || undefined}
      style={style}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      aria-current={active ? 'true' : undefined}
      onClick={onSelect}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
    >
      <span className="md-seat__order">{order}</span>
      <span className="md-seat__body">
        <span className="md-seat__name">{name}</span>
        {detail ? <span className="md-seat__meta">{detail}</span> : null}
      </span>
    </div>
  );
}
