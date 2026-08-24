import * as React from 'react';
import { MazeDeckProvider } from '@maze-deck/ui';
import { apply, createGame, IllegalActionError } from '@maze-deck/rules';
import type { GameAction } from '@maze-deck/rules';
import { load, newId, runConfigFor, save } from './campaign';
import type { Campaign } from './campaign';
import { CampaignScreen } from './screens/CampaignScreen';
import { SessionScreen } from './screens/SessionScreen';

export function App() {
  const [campaign, setCampaign] = React.useState<Campaign>(() => load());
  const [inRun, setInRun] = React.useState(() => campaign.run !== null);
  const [error, setError] = React.useState<string | null>(null);

  // Every change is written straight through. A closed tab loses nothing.
  React.useEffect(() => { save(campaign); }, [campaign]);

  const dispatch = React.useCallback((action: GameAction) => {
    setCampaign((prev) => {
      if (!prev.run) return prev;
      try {
        const { state } = apply(prev.run, action);
        setError(null);
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
    }));
    setError(null);
    setInRun(true);
  }, []);

  return (
    <MazeDeckProvider size="md" className="t-app">
      {inRun && campaign.run ? (
        <SessionScreen
          state={campaign.run}
          dispatch={dispatch}
          error={error}
          runName={campaign.runName}
          onExit={() => setInRun(false)}
        />
      ) : (
        <CampaignScreen
          campaign={campaign}
          onChange={setCampaign}
          onStart={startRun}
          hasRun={campaign.run !== null}
          onResume={() => setInRun(true)}
        />
      )}
    </MazeDeckProvider>
  );
}
