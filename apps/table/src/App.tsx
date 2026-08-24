import * as React from 'react';
import { MazeDeckProvider } from '@maze-deck/ui';
import { apply, createGame, IllegalActionError, view } from '@maze-deck/rules';
import type { GameAction, Viewer } from '@maze-deck/rules';
import { load, newId, runConfigFor, save } from './campaign';
import type { Campaign } from './campaign';
import { drawPrompt } from './tables';
import { CampaignScreen } from './screens/CampaignScreen';
import { SessionScreen } from './screens/SessionScreen';
import { TablesScreen } from './screens/TablesScreen';

type Screen = 'campaign' | 'tables' | 'session';

export function App() {
  const [campaign, setCampaign] = React.useState<Campaign>(() => load());
  const [screen, setScreen] = React.useState<Screen>(
    () => (campaign.run !== null ? 'session' : 'campaign'),
  );
  const [error, setError] = React.useState<string | null>(null);

  /**
   * The GM can look at their own screen as a player would see it. This
   * is not a UI filter — it rebuilds the view through the same
   * redaction the server will use in M4, so what disappears here is
   * exactly what will never be sent.
   */
  const [asPlayer, setAsPlayer] = React.useState(false);
  const viewer: Viewer = asPlayer && campaign.roster[0]
    ? { role: 'player', seatId: campaign.roster[0].id }
    : { role: 'gm' };

  // Every change is written straight through. A closed tab loses nothing.
  React.useEffect(() => { save(campaign); }, [campaign]);

  const dispatch = React.useCallback((action: GameAction) => {
    setCampaign((prev) => {
      if (!prev.run) return prev;
      try {
        const { state } = apply(prev.run, action);
        setError(null);

        // A card has just been turned over: draw the GM a line to
        // describe it with, and hold it until the next reveal.
        if (action.type === 'PICK_SLOT' && state.revealed) {
          const { category } = state.revealed;
          const drawn = drawPrompt(prev.tables, category, prev.lastPrompt[category]);
          return {
            ...prev,
            run: state,
            prompt: drawn,
            lastPrompt: drawn
              ? { ...prev.lastPrompt, [category]: drawn.entryId }
              : prev.lastPrompt,
          };
        }

        return { ...prev, run: state };
      } catch (e) {
        // An illegal action is a bug or a stale click, never a crash.
        setError(e instanceof IllegalActionError ? e.message : String(e));
        return prev;
      }
    });
  }, []);

  const startRun = React.useCallback(() => {
    setCampaign((prev) => ({
      ...prev,
      run: createGame(runConfigFor(prev, newId())),
      prompt: null,
      lastPrompt: {},
    }));
    setError(null);
    setScreen('session');
  }, []);

  return (
    <MazeDeckProvider size="md" className="t-app">
      {screen === 'session' && campaign.run ? (
        <SessionScreen
          view={view(campaign.run, viewer)}
          dispatch={dispatch}
          error={error}
          runName={campaign.runName}
          // The scenario prompt is the GM's to read before they narrate
          // it, so a player's screen never carries it.
          prompt={viewer.role === 'gm' ? campaign.prompt : null}
          asPlayer={asPlayer}
          onTogglePlayerView={() => setAsPlayer((v) => !v)}
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
