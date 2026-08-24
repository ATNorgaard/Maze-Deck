import * as React from 'react';
import { PlayerSeat } from '@maze-deck/ui';

/**
 * The initiative order. It doubles as navigation order AND combat
 * order, so when a Monster turns up the same list carries straight
 * into the fight without a re-roll.
 */
export const InitiativeOrder = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260 }}>
    <PlayerSeat name="Brakka" order={1} active detail="Fighter · STR 18" />
    <PlayerSeat name="Wren" order={2} detail="Rogue · DEX 17" />
    <PlayerSeat name="Odalis" order={3} detail="Cleric · WIS 16" />
    <PlayerSeat name="The Maze" order={4} detail="Game master" />
  </div>
);

/** Whose turn it is, and whose it is not. */
export const ActiveAndIdle = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260 }}>
    <PlayerSeat name="Brakka" order={1} active detail="Fighter · STR 18" />
    <PlayerSeat name="Wren" order={2} detail="Rogue · DEX 17" />
  </div>
);

/** Without the secondary line. */
export const NameOnly = () => (
  <div style={{ minWidth: 260 }}>
    <PlayerSeat name="Odalis" order={3} />
  </div>
);
