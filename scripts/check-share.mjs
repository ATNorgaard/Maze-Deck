/* ============================================================
   Check the `share` operation against a running session authority.

   Sharing a scene with the table (DECISIONS O1, docs/overhaul.md
   phase 8): the GM's alone, only a scene from this crossing, carried in
   every reply beside the view, cleared by a fresh crossing — and, on a
   table without the `scene` column, refused with the reason while
   everything else goes on working.

     node scripts/check-share.mjs [--url=http://127.0.0.1:8790] [--unmigrated]

   Point it at scripts/local-session.mjs (started with the same
   --unmigrated or not). It creates a room with a random code and
   plays to a pick; it never touches anything but that room.
   ============================================================ */
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const url = flag('url', 'http://127.0.0.1:8790');
const unmigrated = args.includes('--unmigrated');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const mods = { STR: 1, DEX: 1, CON: 1, INT: 1, WIS: 1, CHA: 1 };
const setup = {
  biome: 'dungeon', mazeDc: 15, escapeTarget: 5, riverWidth: 3, encounterAt: 2, obstacleJam: 3, rollMode: 'app',
  abilities: ['forge-a-path'], expansions: [], extraClearPath: 0, extraMonster: 0,
  seats: [{ id: 'wren', name: 'Wren', cls: 'Rogue', mods }],
};

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok ' : '!! '} ${what}`); if (!ok) failed += 1; };
const post = async (op, body) => (await fetch(`${url}/api/session/${op}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, ...body }),
})).json();
const view = async (playerId) => (await fetch(`${url}/api/session/view?code=${code}&playerId=${playerId}`)).json();

const gm = 'gm-check';
const player = 'player-check';

let r = await post('create', { playerId: gm, setup });
check(r.view && r.scene === null, 'a new room carries no scene');
await post('join', { playerId: player, role: 'player', seatId: 'wren' });

// To a pick: the one action, ruled a success, then the left path.
await post('act', { playerId: gm, action: { type: 'USE_ABILITY', ability: 'forge-a-path' } });
await post('act', { playerId: gm, action: { type: 'CONFIRM_CHECK', success: true } });
r = await post('act', { playerId: gm, action: { type: 'PICK_SLOT', index: 0 } });
const pickLine = r.view.log[r.view.log.length - 1].n;
const category = r.view.revealed.category;
const scene = { key: `${pickLine}:0`, category, entryId: 'cp-door', text: 'A door already standing open.' };

r = await post('share', { playerId: player, scene });
check(/Only the GM/.test(r.error ?? ''), `a player cannot share: "${r.error}"`);

if (unmigrated) {
  r = await post('share', { playerId: gm, scene });
  check(/migrated/.test(r.error ?? ''), `an unmigrated table refuses with the reason: "${r.error}"`);
  r = await post('create', { playerId: gm, setup });
  check(Boolean(r.view) && !r.error, 'and a fresh crossing in the same room still works');
} else {
  r = await post('share', { playerId: gm, scene: { ...scene, key: '999:0' } });
  check(/not a scene from this crossing/.test(r.error ?? ''), `a scene from no pick is refused: "${r.error}"`);
  r = await post('share', { playerId: gm, scene: { ...scene, key: `${pickLine}:2` } });
  check(/not a scene from this crossing/.test(r.error ?? ''), 'a scene for a path nobody took is refused');
  r = await post('share', { playerId: gm, scene: { ...scene, category: category === 'monster' ? 'item' : 'monster' } });
  check(/not a scene from this crossing/.test(r.error ?? ''), 'a scene for a card that was not turned is refused');
  r = await post('share', { playerId: gm, scene: { ...scene, text: 'x'.repeat(700) } });
  check(Boolean(r.error), 'an essay is refused');

  r = await post('share', { playerId: gm, scene });
  check(r.scene?.key === scene.key && r.scene?.text === scene.text, 'the GM shares it');
  const version = r.version;
  r = await post('share', { playerId: gm, scene });
  check(r.version === version, 'sharing it again writes nothing');

  r = await view(player);
  check(r.scene?.key === scene.key, "the player's view carries it, beside the view");
  check(!JSON.stringify(r.view).includes('A door already standing open'), 'and the view itself never holds it');

  r = await post('share', { playerId: gm, scene: null });
  check(r.scene === null && r.version > version, 'the GM can take it down again');

  await post('share', { playerId: gm, scene });
  r = await post('create', { playerId: gm, setup });
  check(r.scene === null, 'a fresh crossing in the room clears it');
}

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
