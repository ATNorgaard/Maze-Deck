/* ============================================================
   One session.

   This object is the authority. It holds GameState, and nothing
   that leaves it is anything but a redacted GameView — the seed,
   the generator and the deck's order never cross the wire.

   It is the same shape as LocalSession in apps/table, on purpose:
   own the state, refuse what mayAct rejects, own the reveal timer,
   emit only views. The difference is where it runs.
   ============================================================ */

import { apply, createGame, IllegalActionError } from '../../../packages/rules/src/engine';
import { mayAct, mayAdvanceReveal, REVEAL_MS } from '../../../packages/rules/src/authority';
import { view } from '../../../packages/rules/src/view';
import type { GameState } from '../../../packages/rules/src/types';
import type { Viewer } from '../../../packages/rules/src/view';
import type {
  ClientMessage, Presence, RunSetup, SeatOffer, ServerMessage,
} from '../../../packages/rules/src/protocol';

/** What each open socket is, remembered across hibernation. */
interface Attachment {
  playerId: string;
  viewer: Viewer;
}

interface Stored {
  state: GameState | null;
  /** Whoever opened the room. Reconnecting with this id is the GM again. */
  gmPlayerId: string | null;
  /** playerId -> seatId, so a returning device lands back on its seat. */
  seats: Record<string, string>;
}

export class SessionRoom {
  private ctx: DurableObjectState;

  private loaded: Stored | null = null;

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
  }

  /* ---------------- storage ---------------- */

  private async load(): Promise<Stored> {
    if (this.loaded) return this.loaded;
    const stored = await this.ctx.storage.get<Stored>('room');
    this.loaded = stored ?? { state: null, gmPlayerId: null, seats: {} };
    return this.loaded;
  }

  private async persist(): Promise<void> {
    if (this.loaded) await this.ctx.storage.put('room', this.loaded);
  }

  /* ---------------- sockets ---------------- */

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    // Hibernation: the room can be evicted between turns and woken by
    // a message or the reveal alarm without dropping anybody.
    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    } catch {
      return this.sendTo(ws, { t: 'error', message: 'Unreadable message' });
    }

    switch (msg.t) {
      case 'ping':
        return this.sendTo(ws, { t: 'pong' });
      case 'create':
        return this.onCreate(ws, msg.playerId, msg.setup);
      case 'join':
        return this.onJoin(ws, msg.playerId, msg.role, msg.seatId);
      case 'action':
        return this.onAction(ws, msg);
      default:
        return this.sendTo(ws, { t: 'error', message: 'Unknown message' });
    }
  }

  async webSocketClose(): Promise<void> {
    await this.broadcast();
  }

  async webSocketError(): Promise<void> {
    await this.broadcast();
  }

  /* ---------------- joining ---------------- */

  private async onCreate(ws: WebSocket, playerId: string, setup: RunSetup): Promise<void> {
    const room = await this.load();

    // Re-creating is how a GM starts a fresh crossing in the same room.
    if (room.state && room.gmPlayerId !== playerId) {
      return this.sendTo(ws, { t: 'error', message: 'That code is already in use.' });
    }

    // The seed is generated HERE. It is the one value that would let a
    // client compute the whole deck, so it never travels.
    const seed = crypto.randomUUID();
    room.state = createGame({ ...setup, seed });
    room.gmPlayerId = playerId;
    room.seats = {};
    await this.persist();

    this.attach(ws, { playerId, viewer: { role: 'gm' } });
    await this.armReveal();
    await this.broadcast();
  }

  private async onJoin(
    ws: WebSocket,
    playerId: string,
    role: 'gm' | 'player',
    seatId?: string,
  ): Promise<void> {
    const room = await this.load();

    // The GM is whoever opened the room, not whoever asks. A client
    // claiming 'gm' without the original id is seated as a player.
    const isGm = room.gmPlayerId !== null && room.gmPlayerId === playerId;
    if (role === 'gm' && !isGm) {
      return this.sendTo(ws, { t: 'error', message: 'This session already has a GM.' });
    }

    if (isGm) {
      this.attach(ws, { playerId, viewer: { role: 'gm' } });
    } else {
      const remembered = room.seats[playerId];
      const claimed = seatId ?? remembered;
      const seat = room.state?.config.seats.find((s) => s.id === claimed);
      if (!seat) {
        // Not an error: a player cannot know the roster until they
        // arrive, so arriving without a seat is how you ask for it.
        return this.sendTo(ws, { t: 'seats', seats: this.seatOffers(playerId) });
      }
      const takenBy = Object.entries(room.seats)
        .find(([id, sid]) => sid === seat.id && id !== playerId);
      if (takenBy) {
        return this.sendTo(ws, { t: 'error', message: 'Somebody already has that seat.' });
      }
      room.seats[playerId] = seat.id;
      await this.persist();
      this.attach(ws, { playerId, viewer: { role: 'player', seatId: seat.id } });
    }

    await this.broadcast();
  }

  /* ---------------- play ---------------- */

  private async onAction(
    ws: WebSocket,
    msg: Extract<ClientMessage, { t: 'action' }>,
  ): Promise<void> {
    const room = await this.load();
    const who = this.attachmentOf(ws);
    if (!who) return this.sendTo(ws, { t: 'error', message: 'Join first.' });
    if (!room.state) return this.sendTo(ws, { t: 'error', message: 'No run here yet.' });

    // The same check the client ran to grey the control out. This one
    // is the one that counts.
    const verdict = mayAct(view(room.state, who.viewer), who.viewer, msg.action);
    if (!verdict.ok) {
      return this.sendTo(ws, { t: 'error', message: verdict.reason });
    }

    try {
      room.state = apply(room.state, msg.action).state;
    } catch (e) {
      const message = e instanceof IllegalActionError ? e.message : 'That did not work.';
      return this.sendTo(ws, { t: 'error', message });
    }

    await this.persist();
    await this.armReveal();
    await this.broadcast();
  }

  /**
   * The reveal advances on this object's clock, never a client's.
   *
   * `mayAdvanceReveal` makes it idempotent: an alarm that fires late,
   * twice, or after a reconnect finds the phase already moved on and
   * does nothing.
   */
  private async armReveal(): Promise<void> {
    const room = await this.load();
    if (room.state?.phase === 'reveal') {
      await this.ctx.storage.setAlarm(Date.now() + REVEAL_MS);
    }
  }

  async alarm(): Promise<void> {
    const room = await this.load();
    if (!room.state) return;
    if (!mayAdvanceReveal(view(room.state, { role: 'gm' }))) return;

    try {
      room.state = apply(room.state, { type: 'ADVANCE_REVEAL' }).state;
    } catch {
      return;
    }
    await this.persist();
    await this.armReveal();
    await this.broadcast();
  }

  /* ---------------- plumbing ---------------- */

  private attach(ws: WebSocket, attachment: Attachment): void {
    ws.serializeAttachment(attachment);
  }

  private attachmentOf(ws: WebSocket): Attachment | null {
    try {
      return (ws.deserializeAttachment() as Attachment | null) ?? null;
    } catch {
      return null;
    }
  }

  /** The roster, marked with what is already claimed by somebody else. */
  private seatOffers(asking: string): SeatOffer[] {
    const room = this.loaded;
    const seats = room?.state?.config.seats ?? [];
    return seats.map((s) => {
      const holder = Object.entries(room?.seats ?? {})
        .find(([, sid]) => sid === s.id)?.[0];
      const offer: SeatOffer = {
        id: s.id,
        name: s.name,
        taken: holder !== undefined && holder !== asking,
      };
      if (s.cls !== undefined) offer.cls = s.cls;
      return offer;
    });
  }

  private presence(): Presence[] {
    return this.ctx.getWebSockets()
      .map((ws) => this.attachmentOf(ws))
      .filter((a): a is Attachment => a !== null)
      .map((a) => ({
        role: a.viewer.role,
        seatId: a.viewer.role === 'player' ? a.viewer.seatId : null,
        connected: true,
      }));
  }

  private sendTo(ws: WebSocket, message: ServerMessage): void {
    try { ws.send(JSON.stringify(message)); } catch { /* gone */ }
  }

  /**
   * Every socket gets its OWN view, built for whoever it belongs to.
   * There is no shared payload that then gets filtered — the redaction
   * happens once per recipient, before anything is written.
   */
  private async broadcast(): Promise<void> {
    const room = await this.load();
    const presence = this.presence();

    for (const ws of this.ctx.getWebSockets()) {
      const who = this.attachmentOf(ws);
      if (!who) continue;
      if (!room.state) {
        this.sendTo(ws, { t: 'waiting', presence });
        continue;
      }
      this.sendTo(ws, {
        t: 'view',
        view: view(room.state, who.viewer),
        presence,
      });
    }
  }
}
