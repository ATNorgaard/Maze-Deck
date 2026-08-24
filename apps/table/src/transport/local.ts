/* ============================================================
   The in-tab session.

   Behaves exactly as the server will: it holds the authoritative
   GameState, refuses anything `mayAct` rejects, owns the reveal
   timer, and hands out nothing but redacted views.

   That symmetry is deliberate. When the socket transport arrives
   the only difference should be where this object is running.
   ============================================================ */

import {
  apply, IllegalActionError, mayAct, mayAdvanceReveal, REVEAL_MS, view,
} from '@maze-deck/rules';
import type { GameAction, GameState, Viewer } from '@maze-deck/rules';
import type { SessionTransport, Snapshot } from './types';

export interface LocalOptions {
  state: GameState;
  viewer?: Viewer;
  /** Called with the authoritative state so the host can persist it. */
  onState?: (state: GameState) => void;
}

export class LocalSession implements SessionTransport {
  private state: GameState;

  private viewer: Viewer;

  private listeners = new Set<(s: Snapshot) => void>();

  private error: string | null = null;

  private revealTimer: number | null = null;

  private readonly onState: ((state: GameState) => void) | undefined;

  constructor(options: LocalOptions) {
    this.state = options.state;
    this.viewer = options.viewer ?? { role: 'gm' };
    this.onState = options.onState;
    this.armReveal();
  }

  subscribe(listener: (s: Snapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => { this.listeners.delete(listener); };
  }

  send(action: GameAction): void {
    const verdict = mayAct(view(this.state, this.viewer), this.viewer, action);
    if (!verdict.ok) {
      this.error = verdict.reason;
      this.emit();
      return;
    }
    this.commit(action);
  }

  setViewer(viewer: Viewer): void {
    this.viewer = viewer;
    this.emit();
  }

  close(): void {
    this.disarmReveal();
    this.listeners.clear();
  }

  /** Replace the run, e.g. when a new crossing starts. */
  reset(state: GameState): void {
    this.disarmReveal();
    this.state = state;
    this.error = null;
    this.armReveal();
    this.onState?.(this.state);
    this.emit();
  }

  private commit(action: GameAction): void {
    try {
      this.state = apply(this.state, action).state;
      this.error = null;
    } catch (e) {
      this.error = e instanceof IllegalActionError ? e.message : String(e);
      this.emit();
      return;
    }
    this.onState?.(this.state);
    this.armReveal();
    this.emit();
  }

  /**
   * The reveal advances on the session's clock, not a client's.
   *
   * Re-armed after every commit and guarded by `mayAdvanceReveal`, so a
   * stale timer that fires late finds the phase already moved on and
   * does nothing.
   */
  private armReveal(): void {
    this.disarmReveal();
    if (this.state.phase !== 'reveal') return;
    this.revealTimer = window.setTimeout(() => {
      this.revealTimer = null;
      if (!mayAdvanceReveal(view(this.state, { role: 'gm' }))) return;
      this.commit({ type: 'ADVANCE_REVEAL' });
    }, REVEAL_MS);
  }

  private disarmReveal(): void {
    if (this.revealTimer !== null) {
      window.clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }
  }

  private snapshot(): Snapshot {
    return {
      view: view(this.state, this.viewer),
      viewer: this.viewer,
      // One device, one seat at the table: presence is a network idea.
      presence: [],
      error: this.error,
      connected: true,
    };
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const listener of this.listeners) listener(snap);
  }
}
