/* ============================================================
   The crossing, told back (docs/overhaul.md, phase 7).

   The chronicle (campaign.ts) keeps every scene drawn and when; the
   log keeps what came of it. `tell` puts the two together for the end
   screen: the scenes round by round, who took each path, and which of
   them got the party found and how that went. `recap` is the same as
   plain text, for the GM to read out or keep for next session.

   Pure. The encounters are read off the log's cues (DECISIONS O2):
   a `found` line, then whatever the GM reported — a Monster out of the
   deck for good (`good`), a getaway (`bad`), or the end (`lost`).
   ============================================================ */

import type { GameEvent, GameView } from '@maze-deck/rules';
import { getCategory } from '@maze-deck/ui';
import type { ChronicleEntry } from './campaign';

export type Fight = 'won' | 'away' | 'lost' | 'unsettled';

export interface StoryScene {
  entry: ChronicleEntry;
  /** Who took the path, by name. */
  who: string | null;
  /** Which path: left, centre, right. */
  path: string;
  /** Set on the scene whose Monster got the party found. */
  fight: Fight | null;
}

export interface StoryRound {
  round: number;
  scenes: StoryScene[];
}

export interface Story {
  rounds: StoryRound[];
  fights: Fight[];
}

const POSITION = ['left', 'centre', 'right'];

/** The log line a chronicle entry was drawn for: its key is `pickLine:slot`. */
function pickLine(entry: ChronicleEntry): number {
  return Number(entry.key.split(':')[0]) || 0;
}

/** How each encounter in the log went, by the log line it began on. */
export function fightsIn(log: GameEvent[]): Map<number, Fight> {
  const out = new Map<number, Fight>();
  let open: number | null = null;
  for (const e of log) {
    if (e.cue === 'found') {
      if (open !== null) out.set(open, 'unsettled');
      open = e.n;
      out.set(open, 'unsettled');
      continue;
    }
    if (open === null) continue;
    if (e.cue === 'lost') { out.set(open, 'lost'); open = null; }
    else if (e.kind === 'good') { out.set(open, 'won'); open = null; }
    else if (e.kind === 'bad') { out.set(open, 'away'); open = null; }
  }
  return out;
}

export function tell(scenes: ChronicleEntry[], view: Pick<GameView, 'log' | 'seats'>): Story {
  const fights = fightsIn(view.log);
  const ordered = [...scenes].sort((a, b) => pickLine(a) - pickLine(b));

  // Each encounter belongs to the last scene drawn before it began: the
  // Monster that found them.
  const fightOf = new Map<string, Fight>();
  for (const [line, fight] of fights) {
    let owner: ChronicleEntry | null = null;
    for (const s of ordered) if (pickLine(s) < line) owner = s;
    if (owner) fightOf.set(owner.key, fight);
  }

  const rounds: StoryRound[] = [];
  for (const entry of ordered) {
    const slot = Number(entry.key.split(':')[1]);
    const scene: StoryScene = {
      entry,
      who: view.seats.find((s) => s.id === entry.seatId)?.name ?? null,
      path: POSITION[slot] ?? `slot ${slot + 1}`,
      fight: fightOf.get(entry.key) ?? null,
    };
    const last = rounds[rounds.length - 1];
    if (last && last.round === entry.round) last.scenes.push(scene);
    else rounds.push({ round: entry.round, scenes: [scene] });
  }
  return { rounds, fights: [...fights.values()] };
}

const FIGHT_LINE: Record<Fight, string> = {
  won: 'Found — and they won. A Monster is gone from the deck for good.',
  away: 'Found — and they got away.',
  lost: 'Found — and it ended there.',
  unsettled: 'Found.',
};

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

/** How the encounters went, in a clause: "found twice: won once, got away once". */
export function fightsPhrase(fights: Fight[]): string {
  const n = fights.length;
  if (n === 0) return 'never found';
  const won = fights.filter((f) => f === 'won').length;
  const away = fights.filter((f) => f === 'away').length;
  if (fights.includes('lost')) return n === 1 ? 'found once, and it ended there' : `found ${times(n)}, and the last time it ended there`;
  if (won === n) return n === 1 ? 'found once, and won' : `found ${times(n)}, and won every time`;
  if (away === n) return n === 1 ? 'found once, and got away' : `found ${times(n)}, and got away every time`;
  const parts = [won ? `won ${times(won)}` : null, away ? `got away ${times(away)}` : null].filter(Boolean);
  return parts.length ? `found ${times(n)}: ${parts.join(', ')}` : `found ${times(n)}`;
}

/** What happened in a fight, in a phrase. */
export function fightLine(fight: Fight): string {
  return FIGHT_LINE[fight];
}

/**
 * The crossing as plain text: the run, how it ended, and every scene
 * round by round, with who took it. For reading out, or for next time.
 */
export function recap(
  story: Story,
  head: { runName: string; setting: string; ending: string },
  cardName: (category: ChronicleEntry['category']) => string = (c) => getCategory(c).title,
): string {
  const lines = [`${head.runName} — ${head.setting}`, head.ending, ''];
  for (const round of story.rounds) {
    lines.push(`Round ${round.round}`);
    for (const s of round.scenes) {
      const who = s.who ? `${s.who}, the ${s.path} path` : `The ${s.path} path`;
      lines.push(`  ${who} — ${cardName(s.entry.category)}: ${s.entry.text}`);
      if (s.fight) lines.push(`    ${fightLine(s.fight)}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
