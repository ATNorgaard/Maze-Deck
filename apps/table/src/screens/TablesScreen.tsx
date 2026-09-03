import * as React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { CANONICAL_CATEGORIES, CATEGORIES, DeckCard, getCategory } from '@maze-deck/ui';
import type { CardCategory } from '@maze-deck/rules';
import { SCORES } from '../campaign';
import type { Campaign } from '../campaign';
import { DEFAULT_TABLES, newEntryId } from '../tables';
import type { TableEntry } from '../tables';

interface Props {
  campaign: Campaign;
  onChange: (next: Campaign) => void;
  onBack: () => void;
}

export function TablesScreen({ campaign, onChange, onBack }: Props) {
  const enabled: CardCategory[] = [
    ...CANONICAL_CATEGORIES.map((c) => c.category),
    ...campaign.expansions,
  ];
  const [active, setActive] = React.useState<CardCategory>('clear-path');
  const category = enabled.includes(active) ? active : 'clear-path';
  const entries = campaign.tables[category] ?? [];
  const def = getCategory(category);
  const isObstacle = CATEGORIES.find((c) => c.category === category)?.blocker ?? false;

  const setEntries = (next: TableEntry[]) =>
    onChange({ ...campaign, tables: { ...campaign.tables, [category]: next } });

  const patch = (id: string, change: Partial<TableEntry>) =>
    setEntries(entries.map((x) => (x.id === id ? { ...x, ...change } : x)));

  return (
    <>
      <div className="t-bar">
        <span className="t-brand">Scenario tables</span>
        <span className="t-spacer" />
        <button
          type="button"
          className="t-btn"
          onClick={() => onChange({
            ...campaign,
            tables: { ...campaign.tables, [category]: structuredClone(DEFAULT_TABLES[category]) },
          })}
        >
          Restore the defaults for {def.title}
        </button>
        <button type="button" className="t-btn t-btn--primary" onClick={onBack}>
          Done
        </button>
      </div>

      <Tabs.Root
        className="t-tables"
        value={category}
        onValueChange={(next) => setActive(next as CardCategory)}
        orientation="vertical"
      >
        <div className="t-col">
          <div className="t-panel">
            <h2 className="t-panel__title">Category</h2>
            <p className="t-note">
              One list per card. When a card is turned over, the app draws a line
              from its list and hands it to you to describe — never the same one
              twice running.
            </p>
            {/* Real tabs: arrow keys move between them and only the
                selected one is a tab stop, which aria-pressed buttons
                could never offer. */}
            <Tabs.List className="t-tabs" aria-label="Card category">
              {enabled.map((key) => {
                const d = getCategory(key);
                const count = campaign.tables[key]?.length ?? 0;
                return (
                  <Tabs.Trigger key={key} value={key} className="t-tab">
                    <span>{d.title}</span>
                    <span className="t-tab__count" data-empty={count === 0 || undefined}>
                      {count}
                    </span>
                  </Tabs.Trigger>
                );
              })}
            </Tabs.List>
          </div>

          <div className="t-centre">
            <DeckCard category={category} size="sm" />
          </div>
        </div>

        {/* One panel, showing whichever category is selected. Wrapped so
            the tabs have something real to point aria-controls at. */}
        <Tabs.Content className="t-col" value={category}>
          <div className="t-panel">
            <h2 className="t-panel__title">{def.title}</h2>
            <p className="t-note">{def.rule}</p>
            {isObstacle ? (
              <p className="t-note" style={{ marginTop: 'calc(2 * var(--md-u))' }}>
                A blocked path can suggest the check it wants. The DC is written
                as an offset from your Maze DC ({campaign.mazeDc}), so raising the
                Maze DC still scales everything from one number.
              </p>
            ) : null}

            <div className="t-entries">
              {entries.length === 0 ? (
                <p className="t-note">
                  Nothing here yet. With an empty list the app stays quiet and
                  leaves the scene entirely to you.
                </p>
              ) : entries.map((entry, i) => (
                <div className="t-entry" key={entry.id}>
                  <span className="t-entry__n">{i + 1}</span>
                  <textarea
                    className="t-input t-entry__text"
                    rows={2}
                    aria-label={`${def.title} entry ${i + 1}`}
                    value={entry.text}
                    onChange={(ev) => patch(entry.id, { text: ev.target.value })}
                  />
                  {isObstacle ? (
                    <div className="t-entry__check">
                      <select
                        className="t-input"
                        aria-label={`Ability for entry ${i + 1}`}
                        value={entry.score ?? ''}
                        onChange={(ev) => patch(entry.id, {
                          score: ev.target.value === ''
                            ? undefined
                            : ev.target.value as TableEntry['score'],
                        })}
                      >
                        <option value="">No suggestion</option>
                        {SCORES.map((sc) => <option key={sc} value={sc}>{sc}</option>)}
                      </select>
                      <select
                        className="t-input"
                        aria-label={`DC offset for entry ${i + 1}`}
                        value={String(entry.dcOffset ?? 0)}
                        disabled={entry.score === undefined}
                        onChange={(ev) => patch(entry.id, { dcOffset: Number(ev.target.value) })}
                      >
                        {[-2, -1, 0, 1, 2].map((n) => (
                          <option key={n} value={n}>
                            {n === 0 ? 'Maze DC' : `Maze DC ${n > 0 ? '+' : ''}${n}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="t-btn t-btn--danger"
                    onClick={() => setEntries(entries.filter((x) => x.id !== entry.id))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="t-row" style={{ marginTop: 'calc(4 * var(--md-u))' }}>
              <button
                type="button"
                className="t-btn"
                onClick={() => setEntries([...entries, { id: newEntryId(), text: '' }])}
              >
                Add a line
              </button>
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </>
  );
}
