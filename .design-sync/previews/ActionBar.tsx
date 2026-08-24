import * as React from 'react';
import { ActionBar } from '@maze-deck/ui';

/** All five actions available — the top of a full-party turn. */
export const AllActions = () => <ActionBar />;

/** The end-of-round d6 disabled one action for the coming round. */
export const WithLockout = () => <ActionBar locked={['its-elementary']} />;

/** A three-player party: actions are cut to party size. */
export const ThreePlayerParty = () => (
  <ActionBar abilities={['forge-a-path', 'scout-ahead', 'boost-morale']} />
);

/** A deeper maze — every check scales off one number. */
export const HarderMaze = () => <ActionBar dc={17} />;
