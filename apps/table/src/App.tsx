import * as React from 'react';
import { MazeDeckProvider } from '@maze-deck/ui';
import { createGame, isJoinCode, makeJoinCode, normaliseJoinCode } from '@maze-deck/rules';
import type {
  CardCategory, GameAction, GameState, SeatOffer, Viewer,
} from '@maze-deck/rules';
import { load, newId, runConfigFor, runSetupFor, save } from './campaign';
import type { Campaign } from './campaign';
import { loadIdentity, rememberSeat, SESSION_ENDPOINT } from './player';
import { drawPrompt } from './tables';
import { LocalSession } from './transport/local';
import { SocketSession } from './transport/socket';
import type { SessionTransport, Snapshot } from './transport/types';
import { CampaignScreen } from './screens/CampaignScreen';
import { LandingScreen } from './screens/LandingScreen';
import { JoinScreen } from './screens/JoinScreen';
import { PlayerScreen } from './screens/PlayerScreen';
import { SessionScreen } from './screens/SessionScreen';
import { TablesScreen } from './screens/TablesScreen';

type Screen = 'landing' | 'campaign' | 'tables' | 'session' | 'join' | 'play';

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

  const revealed = snapshot?.view?.revealed ?? null;
  const revealKey = revealed ? `${revealed.slot}:${revealed.category}` : '';
  React.useEffect(() => {
    if (!revealKey) return;
    const category = revealKey.split(':')[1] as CardCategory;
    setCampaign((prev) => {
      const drawn = drawPrompt(prev.tables, category, prev.lastPrompt[category]);
      if (!drawn) return prev;
      return {
        ...prev,
        prompt: drawn,
        lastPrompt: { ...prev.lastPrompt, [category]: drawn.entryId },
      };
    });
  }, [revealKey]);

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
    attach(new SocketSession({
      endpoint: SESSION_ENDPOINT,
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
    if (!(s instanceof SocketSession)) return;
    setSeatOffers(s.seatOffers);
  }, [snapshot]);

  /* ---------------- the GM, hosting ---------------- */

  const host = React.useCallback(() => {
    const code = campaign.hostCode || makeJoinCode();
    setCampaign((prev) => ({ ...prev, hostCode: code, prompt: null, lastPrompt: {} }));
    attach(new SocketSession({
      endpoint: SESSION_ENDPOINT,
      code,
      playerId: identity.current.playerId,
      role: 'gm',
      create: runSetupFor(campaign),
    }));
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
      return { ...prev, run: state, prompt: null, lastPrompt: {} };
    });
    setAsPlayer(false);
    setScreen('session');
  }, [ensureLocal]);

  const view = snapshot?.view ?? null;
  const hosted = session.current instanceof SocketSession;

  return (
    <MazeDeckProvider size="md" className="t-app">
      {screen === 'play' && view ? (
        <PlayerScreen
          view={view}
          dispatch={dispatch}
          connected={snapshot?.connected ?? false}
          error={snapshot?.error ?? null}
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
        <SessionScreen
          view={view}
          dispatch={dispatch}
          error={snapshot?.error ?? null}
          runName={campaign.runName}
          prompt={view.viewer.role === 'gm' ? campaign.prompt : null}
          asPlayer={asPlayer}
          onTogglePlayerView={togglePlayerView}
          {...(hosted && campaign.hostCode ? { hostCode: campaign.hostCode } : {})}
          onExit={() => setScreen('campaign')}
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
    </MazeDeckProvider>
  );
}
