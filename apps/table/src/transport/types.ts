/* ============================================================
   The seam a server sits in.

   The board talks to a transport, never to the engine. One
   implementation runs in this tab (LocalSession); the other talks
   to the authority over HTTPS and listens for a bell on a Supabase
   Realtime topic (RemoteSession). Neither the board nor the panels
   know which one they have, which is the whole point of the
   interface — it has now survived being swapped twice.
   ============================================================ */

import type { GameAction, GameView, Presence, Viewer } from '@maze-deck/rules';

export interface Snapshot {
  /** Null until the session has a run. */
  view: GameView | null;
  viewer: Viewer;
  presence: Presence[];
  /** A refusal or a failure, cleared on the next accepted action. */
  error: string | null;
  connected: boolean;
}

export interface SessionTransport {
  subscribe(listener: (snapshot: Snapshot) => void): () => void;
  /** Fire and forget. Refusals come back as `error` on the snapshot. */
  send(action: GameAction): void;
  /**
   * Look at the session as somebody else. A GM-side preview only —
   * a real client is told who it is by the server and cannot change it.
   */
  setViewer?(viewer: Viewer): void;
  close(): void;
}
