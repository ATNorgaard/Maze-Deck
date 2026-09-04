import { ArchGlyph, DECK_TOTAL, DeckCard, ReferenceCard } from '@maze-deck/ui';
import { BIOMES, biomeOf } from '../biomes';
import { blankCharacter, SCORES } from '../campaign';
import type { Campaign, Character } from '../campaign';

interface Props {
  campaign: Campaign;
  onChange: (next: Campaign) => void;
  onStart: () => void;
  hasRun: boolean;
  onResume: () => void;
  onEditTables: () => void;
  onHost: () => void;
  onJoin: () => void;
  onHome: () => void;
}

function Stepper({
  value, min, max, onChange, label,
}: {
  value: number; min: number; max: number; label: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="t-field">
      <label htmlFor={`step-${label}`}>{label}</label>
      <div className="t-step">
        <button
          type="button" className="t-step__btn" disabled={value <= min}
          aria-label={`Lower ${label}`} onClick={() => onChange(value - 1)}
        >−</button>
        <span className="t-step__value" id={`step-${label}`}>{value}</span>
        <button
          type="button" className="t-step__btn" disabled={value >= max}
          aria-label={`Raise ${label}`} onClick={() => onChange(value + 1)}
        >+</button>
      </div>
    </div>
  );
}

export function CampaignScreen({
  campaign, onChange, onStart, hasRun, onResume, onEditTables, onHost, onJoin,
  onHome,
}: Props) {
  const set = <K extends keyof Campaign>(key: K, value: Campaign[K]) =>
    onChange({ ...campaign, [key]: value });

  const setChar = (id: string, patch: Partial<Character>) =>
    set('roster', campaign.roster.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const deckSize = DECK_TOTAL + campaign.extraClearPath + campaign.extraMonster;
  const ready = campaign.roster.length > 0;
  const biome = biomeOf(campaign.biome);

  return (
    <>
      <div className="t-bar">
        <button
          type="button" className="t-brand t-brand--link" onClick={onHome}
          title="What this is"
        >
          <span className="t-brand__glyph"><ArchGlyph state="seal" /></span>
          Maze Deck
        </button>
        <span className="t-spacer" />
        <span className="t-bar__group">
          <button type="button" className="t-btn" onClick={onJoin}>
            Join a maze
          </button>
          <button type="button" className="t-btn" onClick={onEditTables}>
            Scenario tables
          </button>
          {hasRun ? (
            <button type="button" className="t-btn" onClick={onResume}>
              Back to the run
            </button>
          ) : null}
        </span>
        <span className="t-bar__group">
          <button
            type="button" className="t-btn" disabled={!ready} onClick={onHost}
            title="Open a room your players can join from their own devices"
          >
            Host online
          </button>
          <button
            type="button" className="t-btn t-btn--primary"
            disabled={!ready} onClick={onStart}
          >
            {hasRun ? 'New crossing' : 'Start the crossing'}
          </button>
        </span>
      </div>

      <div className="t-main">
        <div className="t-stack">
          <div className="t-panel">
            <h2 className="t-panel__title">The campaign</h2>
            <div className="t-row" style={{ alignItems: 'flex-end' }}>
              <label className="t-field" style={{ flex: '1 1 220px' }}>
                <span>Campaign</span>
                <input
                  className="t-input" value={campaign.name}
                  onChange={(e) => set('name', e.target.value)}
                />
              </label>
              <label className="t-field" style={{ flex: '1 1 220px' }}>
                <span>This crossing</span>
                <input
                  className="t-input" value={campaign.runName}
                  onChange={(e) => set('runName', e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* The whole page is already wearing the chosen setting — the
              provider above this screen reskins from the campaign — so
              the three cards below are not a mock-up, they are the real
              components in the real palette. */}
          <div className="t-panel">
            <h2 className="t-panel__title">The setting</h2>
            <span className="t-kicker t-setting__kicker">
              Biome — reskins the card copy at the table
            </span>
            <div className="t-chips" role="group" aria-label="Biome">
              {BIOMES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="t-btn"
                  aria-pressed={b.id === campaign.biome}
                  onClick={() => set('biome', b.id)}
                >
                  {b.name}
                </button>
              ))}
            </div>
            <p className="t-note t-setting__flavour">{biome.flavour}</p>
            <div className="t-setting__preview" aria-label="Three cards in this setting">
              <DeckCard category="clear-path" size="sm" showCount={false} />
              <DeckCard category="obstacle" size="sm" showCount={false} />
              <DeckCard category="monster" size="sm" showCount={false} />
            </div>
            <p className="t-note" style={{ marginTop: 'calc(3 * var(--md-u))' }}>
              The rules do not change; the names, the light and the card backs
              do, and each setting keeps its own scenario tables. The small
              capitals on every card still say what it is by the book.
            </p>
          </div>

          <div className="t-panel">
            <h2 className="t-panel__title">
              The party
              <span className="t-panel__aside">
                {campaign.roster.length} {campaign.roster.length === 1 ? 'seat' : 'seats'}
              </span>
            </h2>
            <p className="t-note">
              Modifiers exactly as written on the sheet. Nothing is enforced —
              you are the one who checks them.
            </p>
            <div className="t-roster" style={{ marginTop: 'calc(3 * var(--md-u))' }}>
              {campaign.roster.map((c) => (
                <div className="t-char" key={c.id}>
                  <label className="t-field">
                    <span>Name</span>
                    <input
                      className="t-input" value={c.name}
                      onChange={(e) => setChar(c.id, { name: e.target.value })}
                    />
                  </label>
                  <label className="t-field">
                    <span>Class</span>
                    <input
                      className="t-input" value={c.cls}
                      onChange={(e) => setChar(c.id, { cls: e.target.value })}
                    />
                  </label>
                  <div className="t-mods">
                    {SCORES.map((s) => (
                      <label className="t-mod" key={s}>
                        <span>{s}</span>
                        <input
                          inputMode="numeric"
                          aria-label={`${c.name || 'Character'} ${s}`}
                          value={c.mods[s]}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            setChar(c.id, {
                              mods: { ...c.mods, [s]: Number.isFinite(n) ? n : 0 },
                            });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="button" className="t-x"
                    aria-label={`Remove ${c.name || 'this seat'}`}
                    title="Remove this seat"
                    onClick={() => set('roster', campaign.roster.filter((x) => x.id !== c.id))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="t-row" style={{ marginTop: 'calc(3 * var(--md-u))' }}>
              <button
                type="button" className="t-btn"
                onClick={() => set('roster', [...campaign.roster, blankCharacter()])}
              >
                Add a seat
              </button>
            </div>
          </div>

          <div className="t-panel">
            <h2 className="t-panel__title">The dials</h2>
            <div className="t-dials">
              <Stepper
                label="Maze DC" value={campaign.mazeDc} min={8} max={22}
                onChange={(n) => set('mazeDc', n)}
              />
              <Stepper
                label="Clear Paths to win" value={campaign.escapeTarget} min={2} max={9}
                onChange={(n) => set('escapeTarget', n)}
              />
              <Stepper
                label="Extra Clear Paths" value={campaign.extraClearPath} min={0} max={6}
                onChange={(n) => set('extraClearPath', n)}
              />
              <Stepper
                label="Extra Monsters" value={campaign.extraMonster} min={0} max={6}
                onChange={(n) => set('extraMonster', n)}
              />
            </div>
            <p className="t-note" style={{ marginTop: 'calc(4 * var(--md-u))' }}>
              {deckSize} cards in the deck. The Monsters are the dial that
              actually bites — raising the DC changes surprisingly little,
              because a failed action still lets you take a path.
            </p>
          </div>

          <div className="t-panel">
            <h2 className="t-panel__title">Who rolls?</h2>
            <div className="t-row">
              <button
                type="button" className="t-btn" aria-pressed={campaign.rollMode === 'app'}
                onClick={() => set('rollMode', 'app')}
              >
                The app rolls
              </button>
              <button
                type="button" className="t-btn" aria-pressed={campaign.rollMode === 'manual'}
                onClick={() => set('rollMode', 'manual')}
              >
                Players roll their own
              </button>
            </div>
            <p className="t-note" style={{ marginTop: 'calc(3 * var(--md-u))' }}>
              Either way the result is yours to confirm, and yours to overturn.
            </p>
          </div>
        </div>

        <div className="t-stack t-stack--aside">
          <ReferenceCard variant="loop" dc={campaign.mazeDc} size="md" />
          <ReferenceCard variant="deck" size="md" />
        </div>
      </div>
    </>
  );
}
