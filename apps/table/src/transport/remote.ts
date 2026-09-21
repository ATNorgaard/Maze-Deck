/* ============================================================
   The networked session.

   Same interface as LocalSession, so nothing above it changes. The
   authority is a Vercel function backed by a Postgres row: this
   object posts actions and renders whatever view comes back. It
   never holds GameState and never decides whether an action was
   allowed.

   It replaced a WebSocket to a Durable Object, and the shape of the
   conversation changed with it. A socket pushed this client its own
   redacted view. Now Supabase Realtime pushes a version number and
   nothing else — there is no secret on that topic to leak — and this
   object comes back to /api/session/view to be handed its own.

   Three things keep a dropped connection from stopping the game:
   a refetch whenever the channel (re)subscribes, a slow poll behind
   it, and the fact that every reply carries a version, so a view
   that arrives out of order is simply discarded.
   ============================================================ */

import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { normaliseJoinCode, REVEAL_MS } from '@maze-deck/rules';
import type {
  GameAction, GameView, Presence, RunSetup, SeatOffer, Viewer,
} from '@maze-deck/rules';
import { API_BASE, REALTIME } from '../player';
import type { SessionTransport, Snapshot } from './types';

export interface RemoteOptions {
  code: string;
  /** The browser's anonymous, persistent id. See DECISIONS P5. */
  playerId: string;
  /** Open a new run here. Omit to join one that exists. */
  create?: RunSetup;
  role: 'gm' | 'player';
  seatId?: string;
}

/** What the authority sends back. Never anything but a view. */
interface Reply {
  viewer?: Viewer;
  view?: GameView | null;
  version?: number;
  topic?: string;
  seats?: SeatOffer[];
  error?: string;
  ok?: boolean;
}

/** Whoever is in the room, as they describe themselves to the topic. */
interface Tracked {
  role: 'gm' | 'player';
  seatId: string | null;
}

/** Connected but quiet: check in this often anyway. */
const HEARTBEAT_MS = 30_000;
/** No topic, or it dropped: this is the only thing keeping up. */
const FALLBACK_MS = 6_000;

export class RemoteSession implements SessionTransport {
  private options: RemoteOptions;

  private listeners = new Set<(s: Snapshot) => void>();

  private snap: Snapshot;

  private supabase: SupabaseClient | null = null;

  private channel: RealtimeChannel | null = null;

  private subscribed = false;

  /** The highest version this client has rendered. Guards late replies. */
  private version = 0;

  private lastFetch = 0;

  private poll: number | null = null;

  private reveal: number | null = null;

  private closed = false;

  /**
   * Set when the server says "you are here but not seated". Null once
   * a seat is held — a view arriving means the claim went through.
   */
  seatOffers: SeatOffer[] | null = null;

  constructor(options: RemoteOptions) {
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
    void this.start();
  }

  subscribe(listener: (s: Snapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snap);
    return () => { this.listeners.delete(listener); };
  }

  send(action: GameAction): void {
    // Optimism would be a lie here: the server decides, and it may
    // refuse. The board waits for the view it sends back.
    void this.post('act', { action });
  }

  close(): void {
    this.closed = true;
    if (this.poll !== null) window.clearInterval(this.poll);
    if (this.reveal !== null) window.clearTimeout(this.reveal);
    this.poll = null;
    this.reveal = null;
    void this.channel?.unsubscribe();
    this.channel = null;
    this.listeners.clear();
  }

  /* ---------------- getting in ---------------- */

  private async start(): Promise<void> {
    const { create, role, seatId } = this.options;
    if (create) {
      await this.post('create', { setup: create });
    } else {
      await this.post('join', { role, ...(seatId ? { seatId } : {}) });
    }
    if (this.closed) return;
    this.listen();
    this.poll = window.setInterval(() => this.tickPoll(), FALLBACK_MS);
  }

  /**
   * The topic carries one number. Everything the game is made of comes
   * back over HTTPS, redacted for this client alone.
   */
  private listen(): void {
    if (!REALTIME) return; // configured without Realtime: the poll carries it
    this.supabase = createClient(REALTIME.url, REALTIME.anonKey, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });

    const channel = this.supabase.channel(`session:${this.options.code}`, {
      config: { presence: { key: this.options.playerId } },
    });
    this.channel = channel;

    channel
      .on('broadcast', { event: 'bump' }, ({ payload }) => {
        const v = Number((payload as { v?: number } | undefined)?.v ?? 0);
        if (v > this.version) void this.fetchView();
      })
      .on('presence', { event: 'sync' }, () => this.syncPresence())
      .subscribe((status) => {
        this.subscribed = status === 'SUBSCRIBED';
        this.update({ connected: this.subscribed });
        if (!this.subscribed) return;
        // A fresh subscription may have missed bumps while it was away.
        void this.fetchView();
        void channel.track(this.tracked());
      });
  }

  private tracked(): Tracked {
    const { viewer } = this.snap;
    return {
      role: viewer.role,
      seatId: viewer.role === 'player' ? viewer.seatId : null,
    };
  }

  /**
   * Presence used to be the Durable Object counting its own sockets.
   * It is now the clients describing themselves to the topic, which is
   * the one piece of this that got simpler: nobody has to be told who
   * left, because leaving is what the topic notices.
   */
  private syncPresence(): void {
    const state = this.channel?.presenceState<Tracked>() ?? {};
    const presence: Presence[] = Object.values(state)
      .flat()
      .map((p) => ({ role: p.role, seatId: p.seatId, connected: true }));
    this.update({ presence });
  }

  /* ---------------- keeping up ---------------- */

  private tickPoll(): void {
    if (this.closed) return;
    const stale = this.subscribed
      ? Date.now() - this.lastFetch > HEARTBEAT_MS
      : true;
    if (stale) void this.fetchView();
  }

  private async fetchView(): Promise<void> {
    const { code, playerId } = this.options;
    const url = `${API_BASE}/api/session/view?code=${code}&playerId=${encodeURIComponent(playerId)}`;
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      this.absorb((await response.json()) as Reply);
    } catch {
      this.update({ connected: false });
    }
  }

  private async post(op: string, body: Record<string, unknown>): Promise<void> {
    const { code, playerId } = this.options;
    try {
      const response = await fetch(`${API_BASE}/api/session/${op}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, playerId, ...body }),
      });
      this.absorb((await response.json()) as Reply);
    } catch {
      this.update({ connected: false, error: 'Could not reach the session.' });
    }
  }

  /**
   * Take a reply for what it is, and only if it is newer.
   *
   * Out-of-order arrivals are ordinary here — a poll and a bump can
   * overtake each other — so the version is the only thing that decides
   * whether a view is worth rendering.
   */
  private absorb(reply: Reply): void {
    if (this.closed) return;
    this.lastFetch = Date.now();

    if (reply.error) {
      this.update({ error: reply.error, connected: true });
      return;
    }

    if (reply.seats) {
      // In the room, not yet seated. Not an error: it is the roster
      // arriving, which is how a player learns who is at the table.
      this.seatOffers = reply.seats;
      this.update({ error: null, connected: true });
      return;
    }

    if (reply.version !== undefined && reply.version < this.version) return;
    if (reply.version !== undefined) this.version = reply.version;

    if (reply.view !== undefined) {
      this.seatOffers = null;
      const patch: Partial<Snapshot> = {
        view: reply.view,
        error: null,
        connected: true,
      };
      if (reply.viewer) patch.viewer = reply.viewer;
      this.update(patch);
      // Tell the topic who we turned out to be — a player who arrived
      // without a seat has one now.
      if (reply.viewer && this.subscribed) void this.channel?.track(this.tracked());
      this.armReveal(reply.view);
    }
  }

  /**
   * Nudge the held reveal, once, when it has been up long enough.
   *
   * This is NOT the client advancing the phase: `tick` carries no
   * action, the server refuses it before its own deadline, and
   * mayAdvanceReveal drops one that arrives after the phase moved. It
   * is a doorbell, and every client in the room rings it — the jitter
   * only keeps them from all ringing in the same millisecond.
   */
  private armReveal(view: GameView | null): void {
    if (this.reveal !== null) {
      window.clearTimeout(this.reveal);
      this.reveal = null;
    }
    if (view?.phase !== 'reveal') return;
    this.reveal = window.setTimeout(() => {
      this.reveal = null;
      void this.post('tick', {});
    }, REVEAL_MS + 150 + Math.random() * 350);
  }

  private update(patch: Partial<Snapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const listener of this.listeners) listener(this.snap);
  }
}
