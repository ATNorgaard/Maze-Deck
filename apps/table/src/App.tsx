import * as React from 'react';
import { MazeDeckProvider } from '@maze-deck/ui';
import { createGame, isJoinCode, makeJoinCode, normaliseJoinCode } from '@maze-deck/rules';
import type {
  GameAction, GameState, SeatOffer, Viewer,
} from '@maze-deck/rules';
import { biomeOf, skinOf } from './biomes';
import type { BiomeId } from './biomes';
import { load, newId, runConfigFor, runSetupFor, save, tablesFor } from './campaign';
import type { Campaign, ChronicleEntry } from './campaign';
import { loadIdentity, rememberSeat } from './player';
import { picksIn, undrawn } from './picks';
import { drawPrompt } from './tables';
import { LocalSession } from './transport/local';
import { RemoteSession } from './transport/remote';
import type { SessionTransport, SharedScene, Snapshot } from './transport/types';
import { PortalHost } from './components/PortalHost';
import { CampaignScreen } from './screens/CampaignScreen';
import { LandingScreen } from './screens/LandingScreen';
import { JoinScreen } from './screens/JoinScreen';
import { PlayerScreen } from './screens/PlayerScreen';
import { TableScreen } from './screens/TableScreen';
import { TablesScreen } from './screens/TablesScreen';

type Screen = 'landing' | 'campaign' | 'tables' | 'session' | 'join' | 'play';

/** A player's preview carries no narration: the scenes are the GM's. */
const NO_SCENES: ChronicleEntry[] = [];

/** `#/join/ABC234` so a GM can paste a link instead of reading letters out. */
function codeFromHash(): string | null {
  const m = /^#\/join\/([A-Za-z0-9]+)$/.exec(window.location.hash);
  const code = m ? normaliseJoinCode(m[1] ?? '') : '';
  return isJoinCode(code) ? code : null;
}

export function App() {
  const [campaign, setCampaign] = React.useState<Campaign>(() => load());
  const identity = React.useRef(loadIdentity());
  const deepLink = React.useRef(codeFromHash());

  const [screen, setScreen] = React.useState<Screen>(() => {
    if (deepLink.current) return 'join';
    // A stranger with the bare URL gets told what this is first. Anyone
    // mid-crossing goes straight back to it.
    if (campaign.run !== null) return 'session';
    return 'landing';
  });
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);
  const [asPlayer, setAsPlayer] = React.useState(false);
  const [previewBiome, setPreviewBiome] = React.useState<BiomeId | null>(null);
  // A crossing just started opens with its ceremony (phase 7); a resumed
  // or reloaded one does not.
  const [opening, setOpening] = React.useState<number | null>(null);
  const [joinCode, setJoinCode] = React.useState(deepLink.current ?? '');
  const [seatOffers, setSeatOffers] = React.useState<SeatOffer[] | null>(null);

  const session = React.useRef<SessionTransport | null>(null);
  const unsubscribe = React.useRef<(() => void) | null>(null);

  const detach = React.useCallback(() => {
    unsubscribe.current?.();
    unsubscribe.current = null;
    session.current?.close();
    session.current = null;
    setSnapshot(null);
  }, []);

  const attach = React.useCallback((next: SessionTransport) => {
    detach();
    session.current = next;
    unsubscribe.current = next.subscribe(setSnapshot);
  }, [detach]);

  /* ---------------- the GM, on one screen ---------------- */

  const ensureLocal = React.useCallback((state: GameState) => {
    const current = session.current;
    if (current instanceof LocalSession) {
      current.reset(state);
      return;
    }
    attach(new LocalSession({
      state,
      onState: (next) => setCampaign((prev) => ({ ...prev, run: next })),
    }));
  }, [attach]);

  React.useEffect(() => {
    if (!deepLink.current && campaign.run) ensureLocal(campaign.run);
    return detach;
    // Mount only; later sessions are started explicitly.
  }, []);

  React.useEffect(() => { save(campaign); }, [campaign]);

  /* ---------------- the scenario prompt ---------------- */

  // One draw per card turned, and every draw kept for the run in the
  // chronicle: a Clear Path's scene stands on the route as its landmark.
  // Read off the log rather than the reveal (picks.ts), so a GM whose
  // device polls and misses a player's reveal still gets its scene, with
  // who took the path and when as they were. A card already drawn for (the
  // page reloaded) is read back, not drawn again.
  const shownView = snapshot?.view ?? null;
  const picks = React.useMemo(() => (shownView ? picksIn(shownView) : []), [shownView]);
  const latestPick = picks[picks.length - 1]?.key ?? '';
  React.useEffect(() => {
    if (!shownView || !latestPick) return;
    setCampaign((prev) => {
      const due = undrawn(shownView, prev.chronicle);
      if (!due.length) {
        const known = prev.chronicle.find((e) => e.key === latestPick);
        return known && prev.prompt?.entryId !== known.entryId ? { ...prev, prompt: known } : prev;
      }
      let next = prev;
      for (const pick of due) {
        const drawn = drawPrompt(tablesFor(next), pick.category, next.lastPrompt[pick.category]);
        if (!drawn) continue;
        next = {
          ...next,
          prompt: drawn,
          chronicle: [...next.chronicle, { ...drawn, key: pick.key, round: pick.round, seatId: pick.seatId, progress: pick.progress }],
          lastPrompt: { ...next.lastPrompt, [pick.category]: drawn.entryId },
        };
      }
      return next;
    });
    // Once per card turned; the view is read as it stands then.
  }, [latestPick]);

  /* ---------------- a player, joining ---------------- */

  // The server answers a seatless join with the roster, which is how a
  // player learns who is at the table.
  React.useEffect(() => {
    const view = snapshot?.view;
    if (view && screen === 'join') setScreen('play');
  }, [snapshot?.view, screen]);

  const connectAsPlayer = React.useCallback((seatId?: string) => {
    const code = normaliseJoinCode(joinCode);
    if (!isJoinCode(code)) return;
    const remembered = identity.current.seats[code];
    const claim = seatId ?? remembered;
    attach(new RemoteSession({
      code,
      playerId: identity.current.playerId,
      role: 'player',
      ...(claim ? { seatId: claim } : {}),
    }));
    if (seatId) rememberSeat(code, seatId);
  }, [attach, joinCode]);

  // A seat offer means "you are in the room but not seated yet".
  React.useEffect(() => {
    const s = session.current;
    if (!(s instanceof RemoteSession)) return;
    setSeatOffers(s.seatOffers);
  }, [snapshot]);

  /* ---------------- the GM, hosting ---------------- */

  const host = React.useCallback(() => {
    const code = campaign.hostCode || makeJoinCode();
    setCampaign((prev) => ({ ...prev, hostCode: code, prompt: null, chronicle: [], lastPrompt: {} }));
    attach(new RemoteSession({
      code,
      playerId: identity.current.playerId,
      role: 'gm',
      create: runSetupFor(campaign),
    }));
    setOpening(Date.now());
    setAsPlayer(false);
    setScreen('session');
  }, [attach, campaign]);

  /* ---------------- shared ---------------- */

  const dispatch = React.useCallback((action: GameAction) => {
    session.current?.send(action);
  }, []);

  const togglePlayerView = React.useCallback(() => {
    setAsPlayer((was) => {
      const next = !was;
      const seatId = campaign.roster[0]?.id;
      const viewer: Viewer = next && seatId
        ? { role: 'player', seatId }
        : { role: 'gm' };
      session.current?.setViewer?.(viewer);
      return next;
    });
  }, [campaign.roster]);

  const startRun = React.useCallback(() => {
    setCampaign((prev) => {
      const state = createGame(runConfigFor(prev, newId()));
      ensureLocal(state);
      return { ...prev, run: state, prompt: null, chronicle: [], lastPrompt: {} };
    });
    setOpening(Date.now());
    setAsPlayer(false);
    setScreen('session');
  }, [ensureLocal]);

  const view = snapshot?.view ?? null;
  const hosted = session.current instanceof RemoteSession;

  /* ---------------- showing the table a scene ----------------
     (DECISIONS O1, docs/overhaul.md phase 8.) The GM's board draws the
     line; a hosted room's phones see it when the GM shares it — scene by
     scene from the caption, or every one as it is drawn when the
     campaign says so. */
  const share = React.useCallback((scene: SharedScene | null) => {
    session.current?.share?.(scene);
  }, []);
  const latest = campaign.chronicle[campaign.chronicle.length - 1] ?? null;
  const sharedKey = snapshot?.scene?.key ?? null;
  React.useEffect(() => {
    if (!hosted || !campaign.autoShare || !latest || view?.viewer.role !== 'gm') return;
    if (sharedKey === latest.key) return;
    share({ key: latest.key, category: latest.category, entryId: latest.entryId, text: latest.text });
    // Once per scene drawn; whether it is shown already is read as it stands.
  }, [latest?.key, campaign.autoShare, hosted]);

  // Inside a run the setting is the run's own — it is what every
  // device was told, and a joined player has no campaign at all.
  // Everywhere else it is the campaign's, so a choice on the campaign
  // screen lands on the whole page as it is made.
  const inRun = (screen === 'session' || screen === 'play') && view !== null;
  // A testing override, from the board's setting switch: this screen
  // alone wears another setting. Nothing on the wire changes and no
  // other device sees it. Dropped when the board is left.
  const biome = biomeOf(previewBiome ?? (inRun ? view.rules.biome : campaign.biome));

  return (
    <div className="t-biome" data-biome={biome.id}>
    {/* The setting's light is painted by `.t-app::before` (see app.css),
        a fixed layer that drifts very slowly; the provider itself is
        plain ink underneath it. */}
    <MazeDeckProvider
      size="md"
      className="t-app"
      skin={skinOf(biome)}
    >
      <PortalHost>
      {screen === 'play' && view ? (
        <PlayerScreen
          view={view}
          biome={biome}
          dispatch={dispatch}
          connected={snapshot?.connected ?? false}
          error={snapshot?.error ?? null}
          scene={snapshot?.scene ?? null}
          onLeave={() => { detach(); setSeatOffers(null); setScreen('join'); }}
        />
      ) : screen === 'join' ? (
        <JoinScreen
          code={joinCode}
          onCodeChange={setJoinCode}
          seats={seatOffers}
          connected={snapshot?.connected ?? false}
          error={snapshot?.error ?? null}
          onConnect={() => connectAsPlayer()}
          onClaim={(seatId) => connectAsPlayer(seatId)}
          onBack={() => { detach(); setSeatOffers(null); setScreen('landing'); }}
        />
      ) : screen === 'session' && view ? (
        <TableScreen
          view={view}
          biome={biome}
          dispatch={dispatch}
          error={snapshot?.error ?? null}
          runName={campaign.runName}
          prompt={view.viewer.role === 'gm' ? campaign.prompt : null}
          scenes={view.viewer.role === 'gm' ? campaign.chronicle : NO_SCENES}
          sharedScene={snapshot?.scene ?? null}
          {...(hosted ? { onShare: share } : {})}
          autoShare={campaign.autoShare}
          onAutoShare={(on: boolean) => setCampaign((prev) => ({ ...prev, autoShare: on }))}
          asPlayer={asPlayer}
          onTogglePlayerView={togglePlayerView}
          {...(hosted && campaign.hostCode ? { hostCode: campaign.hostCode } : {})}
          previewBiome={previewBiome}
          onPreviewBiome={setPreviewBiome}
          onExit={() => { setPreviewBiome(null); setOpening(null); setScreen('campaign'); }}
          opening={opening}
          onOpened={() => setOpening(null)}
        />
      ) : screen === 'landing' ? (
        <LandingScreen
          onStart={() => setScreen('campaign')}
          onJoin={() => { detach(); setSeatOffers(null); setScreen('join'); }}
          onResume={campaign.run !== null ? () => setScreen('session') : undefined}
        />
      ) : screen === 'tables' ? (
        <TablesScreen
          campaign={campaign}
          onChange={setCampaign}
          onBack={() => setScreen('campaign')}
        />
      ) : (
        <CampaignScreen
          campaign={campaign}
          onChange={setCampaign}
          onStart={startRun}
          onHost={host}
          onJoin={() => { detach(); setSeatOffers(null); setScreen('join'); }}
          hasRun={campaign.run !== null}
          onResume={() => setScreen('session')}
          onEditTables={() => setScreen('tables')}
          onHome={() => setScreen('landing')}
        />
      )}
      </PortalHost>
    </MazeDeckProvider>
    </div>
  );
}
