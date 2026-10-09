/* ============================================================
   The cards turned in a crossing, as the GM's chronicle needs them.

   The chronicle draws a scene for every card a pick turns. It used to
   draw when the GM's own device saw the reveal, but a device that polls
   (a hosted room without Realtime) can miss a reveal entirely: a
   player's pick turns, resolves and moves on between two polls, and
   that card got no scene. The log never misses one, so it is read from
   there, off each pick's `turned` mark (docs/overhaul.md, phase 8),
   which also says who took the path, in which round, and how far along
   the route the party was.
   ============================================================ */

import type { CardCategory, GameView } from '@maze-deck/rules';

/** A card turned, with what the chronicle records beside its scene. */
export interface Pick {
  /** The pick's log line and the slot: the chronicle's key. */
  key: string;
  /** The pick's log line. */
  n: number;
  category: CardCategory;
  round: number;
  seatId: string | null;
  /** Clear Paths gained before this card. */
  progress: number;
}

/**
 * Every card turned in this view's log, oldest first.
 *
 * A mark written before it carried who, when and how far (world/10 and
 * earlier) is completed from the view as it stands, as the chronicle
 * always did; and a reveal on a log with no mark at all (a crossing begun
 * before world/8) is read off the reveal itself.
 */
export function picksIn(view: GameView): Pick[] {
  const active = view.order[view.turn % Math.max(1, view.order.length)] ?? null;
  const picks: Pick[] = view.log.flatMap((e) => (e.turned ? [{
    key: `${e.n}:${e.turned.slot}`,
    n: e.n,
    category: e.turned.category,
    round: e.turned.round ?? view.round,
    seatId: e.turned.seatId ?? active,
    progress: e.turned.progress ?? view.progress,
  }] : []));
  const last = view.log[view.log.length - 1];
  if (view.phase === 'reveal' && view.revealed && last && !last.turned) {
    picks.push({
      key: `${last.n}:${view.revealed.slot}`, n: last.n, category: view.revealed.category,
      round: view.round, seatId: active, progress: view.progress,
    });
  }
  return picks;
}

/** The pick's log line, from a chronicle key. */
const lineOf = (key: string) => Number(key.split(':')[0]);

/**
 * The cards turned that the chronicle has no scene for yet, oldest first:
 * every one after the newest it has, so a device that missed two reveals
 * catches up on both. A chronicle with nothing in it, on a device that
 * meets a crossing already under way, gets only the latest card: a scene
 * nobody read out does not belong in the storyboard.
 */
export function undrawn(view: GameView, chronicle: readonly { key: string }[]): Pick[] {
  const picks = picksIn(view);
  if (!chronicle.length) return picks.slice(-1);
  const known = new Set(chronicle.map((e) => e.key));
  const newest = Math.max(...chronicle.map((e) => lineOf(e.key)));
  return picks.filter((p) => p.n > newest && !known.has(p.key));
}
