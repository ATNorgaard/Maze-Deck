import * as React from 'react';
import { MazeDeckProvider } from '@maze-deck/ui';
import { createGame } from '@maze-deck/rules';
import type { CardCategory, GameAction, GameState, Viewer } from '@maze-deck/rules';
import { load, newId, runConfigFor, save } from './campaign';
import type { Campaign } from './campaign';
import { drawPrompt } from './tables';
import { LocalSession } from './transport/local';
import type { Snapshot } from './transport/types';
import { CampaignScreen } from './screens/CampaignScreen';
import { SessionScreen } from './screens/SessionScreen';
import { TablesScreen } from './screens/TablesScreen';

type Screen = 'campaign' | 'tables' | 'session';

export function App() {
  const [campaign, setCampaign] = React.useState<Campaign>(() => load());
  const [screen, setScreen] = React.useState<Screen>(
    () => (campaign.run !== null ? 'session' : 'campaign'),
  );
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);
  const [asPlayer, setAsPlayer] = React.useState(false);

  const session = React.useRef<LocalSession | null>(null);
  const unsubscribe = React.useRef<(() => void) | null>(null);

  /**
   * The run belongs to the session, not to React. The transport holds
   * the authoritative state and hands back redacted views — exactly
   * what the server will do — so this component never sees GameState
   * except to hand it over and to persist it.
   *
   * Created once and then `reset`, deliberately: tying its lifetime to
   * `campaign.run` would tear the session down on its own updates.
   */
  const ensureSession = React.useCallback((state: GameState) => {
    if (session.current) {
      session.current.reset(state);
      return;
    }
    const s = new LocalSession({
      state,
      onState: (next) => setCampaign((prev) => ({ ...prev, run: next })),
    });
    session.current = s;
    unsubscribe.current = s.subscribe(setSnapshot);
  }, []);

  React.useEffect(() => {
    if (campaign.run) ensureSession(campaign.run);
    return () => {
      unsubscribe.current?.();
      unsubscribe.current = null;
      session.current?.close();
      session.current = null;
    };
    // Mount only. Later runs come through startRun.
  }, []);

  React.useEffect(() => { save(campaign); }, [campaign]);

  /**
   * Draw the GM a line when a card turns over.
   *
   * Watching the VIEW for a reveal rather than the action means this
   * keeps working when the reveal arrives from a server instead of
   * from a click in this tab.
   */
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
      session.current?.setViewer(viewer);
      return next;
    });
  }, [campaign.roster]);

  const startRun = React.useCallback(() => {
    setCampaign((prev) => {
      const state = createGame(runConfigFor(prev, newId()));
      ensureSession(state);
      return { ...prev, run: state, prompt: null, lastPrompt: {} };
    });
    setAsPlayer(false);
    setScreen('session');
  }, [ensureSession]);

  const view = snapshot?.view ?? null;

  return (
    <MazeDeckProvider size="md" className="t-app">
      {screen === 'session' && view ? (
        <SessionScreen
          view={view}
          dispatch={dispatch}
          error={snapshot?.error ?? null}
          runName={campaign.runName}
          // The scenario prompt is the GM's to read before they narrate
          // it, so a player's screen never carries it.
          prompt={view.viewer.role === 'gm' ? campaign.prompt : null}
          asPlayer={asPlayer}
          onTogglePlayerView={togglePlayerView}
          onExit={() => setScreen('campaign')}
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
          hasRun={campaign.run !== null}
          onResume={() => setScreen('session')}
          onEditTables={() => setScreen('tables')}
        />
      )}
    </MazeDeckProvider>
  );
}
