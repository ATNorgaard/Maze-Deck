/* ============================================================
   The seam a server sits in.

   The board talks to a transport, never to the engine. One
   implementation runs in this tab (LocalSession); the other talks
   to the authority over HTTPS and listens for a bell on a Supabase
   Realtime topic (RemoteSession). Neither the board nor the panels
   know which one they have, which is the whole point of the
   interface — it has now survived being swapped twice.
   ============================================================ */

import type { CardCategory, GameAction, GameView, Presence, Viewer } from '@maze-deck/rules';

/**
 * A scene the GM has shown the table (DECISIONS O1): the line read out
 * for one reveal, keyed `pickLine:slot` as the chronicle keys it, with
 * its card and table entry so a phone draws the picture the GM's board
 * drew. It travels beside the view, never inside it.
 */
export interface SharedScene {
  key: string;
  category: CardCategory;
  entryId: string;
  text: string;
}

export interface Snapshot {
  /** Null until the session has a run. */
  view: GameView | null;
  viewer: Viewer;
  presence: Presence[];
  /** A refusal or a failure, cleared on the next accepted action. */
  error: string | null;
  connected: boolean;
  /** The scene the GM has shown the table, if any. Only a hosted room has one. */
  scene: SharedScene | null;
}

export interface SessionTransport {
  subscribe(listener: (snapshot: Snapshot) => void): () => void;
  /** Fire and forget. Refusals come back as `error` on the snapshot. */
  send(action: GameAction): void;
  /**
   * Show the table a scene, or take it down (null). The GM's alone, and
   * only a hosted room has a table to show: one screen has nobody else.
   */
  share?(scene: SharedScene | null): void;
  /**
   * Look at the session as somebody else. A GM-side preview only —
   * a real client is told who it is by the server and cannot change it.
   */
  setViewer?(viewer: Viewer): void;
  close(): void;
}
