/* ============================================================
   The networked session.

   Same interface as LocalSession, so nothing above it changes.
   The difference is that the authority is a Durable Object in
   another process: this object sends actions and renders whatever
   view comes back. It never holds GameState and never decides
   whether an action was allowed.
   ============================================================ */

import { normaliseJoinCode } from '@maze-deck/rules';
import type {
  GameAction, RunSetup, SeatOffer, ServerMessage,
} from '@maze-deck/rules';
import type { SessionTransport, Snapshot } from './types';

export interface SocketOptions {
  /** Base URL of the worker, e.g. http://localhost:8787 */
  endpoint: string;
  code: string;
  /** The browser's anonymous, persistent id. See DECISIONS P5. */
  playerId: string;
  /** Open a new run here. Omit to join one that exists. */
  create?: RunSetup;
  role: 'gm' | 'player';
  seatId?: string;
}

const RETRY_MS = 1500;
const MAX_RETRY_MS = 15000;

export class SocketSession implements SessionTransport {
  private options: SocketOptions;

  private ws: WebSocket | null = null;

  private listeners = new Set<(s: Snapshot) => void>();

  private snap: Snapshot;

  private retry = RETRY_MS;

  private closed = false;

  private timer: number | null = null;

  /**
   * Set when the server says "you are here but not seated". Null once
   * a seat is held — a view arriving means the claim went through.
   */
  seatOffers: SeatOffer[] | null = null;

  constructor(options: SocketOptions) {
    this.options = { ...options, code: normaliseJoinCode(options.code) };
    this.snap = {
      view: null,
      viewer: options.role === 'gm'
        ? { role: 'gm' }
        : { role: 'player', seatId: options.seatId ?? '' },
      presence: [],
      error: null,
      connected: false,
    };
    this.connect();
  }

  subscribe(listener: (s: Snapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snap);
    return () => { this.listeners.delete(listener); };
  }

  send(action: GameAction): void {
    // Optimism would be a lie here: the server decides, and it may
    // refuse. The board waits for the view it sends back.
    this.post({ t: 'action', action });
  }

  close(): void {
    this.closed = true;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.ws?.close();
    this.ws = null;
    this.listeners.clear();
  }

  private url(): string {
    const base = this.options.endpoint.replace(/^http/, 'ws').replace(/\/+$/, '');
    return `${base}/session/${this.options.code}`;
  }

  private connect(): void {
    if (this.closed) return;
    const ws = new WebSocket(this.url());
    this.ws = ws;

    ws.onopen = () => {
      this.retry = RETRY_MS;
      this.update({ connected: true, error: null });
      const { create, playerId, role, seatId, code } = this.options;
      if (create) {
        this.post({ t: 'create', playerId, setup: create });
      } else {
        this.post(seatId === undefined
          ? { t: 'join', code, role, playerId }
          : { t: 'join', code, role, playerId, seatId });
      }
    };

    ws.onmessage = (event) => {
      let msg: ServerMessage;
      try { msg = JSON.parse(String(event.data)) as ServerMessage; } catch { return; }
      this.receive(msg);
    };

    ws.onclose = () => {
      this.ws = null;
      this.update({ connected: false });
      this.scheduleRetry();
    };

    // onerror is followed by onclose; let that one path do the retry.
    ws.onerror = () => { this.update({ error: 'Lost the session.' }); };
  }

  private scheduleRetry(): void {
    if (this.closed || this.timer !== null) return;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.connect();
    }, this.retry);
    // Back off, so a room that is gone does not get hammered.
    this.retry = Math.min(this.retry * 2, MAX_RETRY_MS);
  }

  private receive(msg: ServerMessage): void {
    switch (msg.t) {
      case 'welcome':
        this.update({
          viewer: msg.viewer, view: msg.view, presence: msg.presence, error: null,
        });
        return;
      case 'view':
        this.seatOffers = null;
        this.update({ view: msg.view, presence: msg.presence, error: null });
        return;
      case 'seats':
        this.seatOffers = msg.seats;
        this.update({ error: null });
        return;
      case 'waiting':
        this.update({ view: null, presence: msg.presence });
        return;
      case 'error':
        this.update({ error: msg.message });
        return;
      case 'pong':
      default:
    }
  }

  private post(message: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.update({ error: 'Not connected.' });
      return;
    }
    this.ws.send(JSON.stringify(message));
  }

  private update(patch: Partial<Snapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const listener of this.listeners) listener(this.snap);
  }
}
