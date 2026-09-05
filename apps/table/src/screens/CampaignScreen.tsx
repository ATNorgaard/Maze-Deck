import * as React from 'react';
import {
  ArchGlyph, CANONICAL_CATEGORIES, CATEGORY_CLASS, DECK_TOTAL, DeckCard, MazeField,
} from '@maze-deck/ui';
import { BIOMES, biomeOf, cardName } from '../biomes';
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
    <div className="t-field t-field--dial">
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

/**
 * A text input that is exactly as wide as what is typed in it. The
 * hidden sizer and the input share one grid cell and one font, so
 * the input takes the sizer's width and the text stays centred as
 * it grows. What the hero's name fields are made of.
 */
function GrowingInput({
  value, placeholder, onChange, className, label,
}: {
  value: string; placeholder: string; onChange: (v: string) => void;
  className: string; label: string;
}) {
  return (
    <label className={`t-grow ${className}`}>
      <span className="t-sr">{label}</span>
      <span className="t-grow__sizer" aria-hidden="true">{value || placeholder}</span>
      <input
        className="t-grow__input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
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
  const seats = campaign.roster.length;
  const ready = seats > 0;
  const biome = biomeOf(campaign.biome);

  // The doors are a strip that scrolls: more settings will come than
  // fit in a row. The chosen one is kept centred, and the arrows only
  // appear once the strip is actually wider than its box.
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = React.useState(false);
  const settled = React.useRef(false);

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const door = track.querySelector<HTMLElement>(`[data-biome="${campaign.biome}"]`);
    if (!door) return;
    const left = door.offsetLeft - (track.clientWidth - door.offsetWidth) / 2;
    // Placed at once on the first paint; slid there after a choice.
    track.scrollTo({ left, behavior: settled.current ? 'smooth' : 'auto' });
    settled.current = true;
  }, [campaign.biome]);

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setOverflowing(track.scrollWidth > track.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, []);

  const turnDoors = (dir: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: dir * track.clientWidth * 0.6, behavior: 'smooth' });
  };

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

      <div className="t-campaign">
        {/* The threshold. The crossing's name is the biggest thing on
            the page, over the setting's own ground and motif, with the
            one line that sums the run up and the button that starts it.
            Both names are typed straight into the title. */}
        <section className="t-hero" aria-label="This crossing">
          <div className="t-hero__field">
            <MazeField motif={biome.motif} fit="cover" />
          </div>
          <div className="t-hero__body">
            <div className="t-hero__kicker">
              <span className="t-kicker">Campaign</span>
              <GrowingInput
                className="t-hero__campaign"
                label="Campaign name"
                value={campaign.name}
                placeholder="A new campaign"
                onChange={(v) => set('name', v)}
              />
            </div>
            <GrowingInput
              className="t-hero__title"
              label="Name of this crossing"
              value={campaign.runName}
              placeholder="Name this crossing"
              onChange={(v) => set('runName', v)}
            />
            <p className="t-hero__summary">
              {biome.name}
              <span className="t-hero__dot">·</span>
              {seats} {seats === 1 ? 'seat' : 'seats'}
              <span className="t-hero__dot">·</span>
              Maze DC {campaign.mazeDc}
              <span className="t-hero__dot">·</span>
              {deckSize} cards
            </p>
            <div className="t-row t-row--centre">
              <button
                type="button" className="t-btn t-btn--primary t-btn--lg"
                disabled={!ready} onClick={onStart}
              >
                {hasRun ? 'New crossing' : 'Start the crossing'}
              </button>
              <button
                type="button" className="t-btn t-btn--lg" disabled={!ready} onClick={onHost}
                title="Open a room your players can join from their own devices"
              >
                Host online
              </button>
            </div>
          </div>
        </section>

        {/* The setting, chosen by picking a door. Every biome is a tile
            in its own palette and card-back field; the chosen one is
            lit. The page behind is already wearing it — the three
            cards under the strip are the real components. */}
        <section className="t-setting" aria-label="The setting">
          <span className="t-kicker t-setting__kicker">The setting — choose a door</span>
          <div className="t-doors" data-overflowing={overflowing || undefined}>
            <button
              type="button" className="t-doors__arrow" aria-label="Earlier settings"
              onClick={() => turnDoors(-1)}
            >
              ‹
            </button>
            <div className="t-doors__track" ref={trackRef} role="radiogroup" aria-label="Biome">
              {BIOMES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={b.id === campaign.biome}
                  className="t-door"
                  data-biome={b.id}
                  onClick={() => set('biome', b.id)}
                >
                  <span className="t-door__field"><MazeField motif={b.motif} fit="cover" /></span>
                  <span className="t-door__fade" />
                  <span className="t-door__glyph"><ArchGlyph state="seal" /></span>
                  <span className="t-door__name">{b.name}</span>
                  <span className="t-door__palette" aria-hidden="true">
                    <i /><i /><i />
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button" className="t-doors__arrow" aria-label="Later settings"
              onClick={() => turnDoors(1)}
            >
              ›
            </button>
          </div>
          <div className="t-setting__body">
            <div className="t-setting__preview" aria-label="Three cards in this setting">
              <DeckCard category="clear-path" size="sm" showCount={false} />
              <DeckCard category="obstacle" size="sm" showCount={false} />
              <DeckCard category="monster" size="sm" showCount={false} />
            </div>
            <div className="t-setting__copy">
              <p className="t-setting__flavour">{biome.flavour}</p>
              <p className="t-note">
                The rules do not change; the names, the light and the card backs
                do, and each setting keeps its own scenario tables. The small
                capitals on every card still say what it is by the book.
              </p>
            </div>
          </div>
        </section>

        <div className="t-campaign__grid">
          {/* The party as a sheet: one ruled line per seat, the column
              names once at the top, no boxes. */}
          <section className="t-sheet" aria-label="The party">
            <div className="t-sheet__head">
              <h2 className="t-panel__title">The party</h2>
              <span className="t-kicker t-sheet__aside">
                {seats} {seats === 1 ? 'seat' : 'seats'} · modifiers as written on the sheet
              </span>
            </div>
            <div className="t-roster">
              <div className="t-char t-char--head" aria-hidden="true">
                <span />
                <span className="t-kicker">Name</span>
                <span className="t-kicker">Class</span>
                <span className="t-mods">
                  {SCORES.map((s) => <span className="t-mod" key={s}><span>{s}</span></span>)}
                </span>
                <span className="t-x" style={{ visibility: 'hidden' }} />
              </div>
              {campaign.roster.map((c, i) => (
                <div className="t-char" key={c.id}>
                  <span className="t-char__order">{i + 1}</span>
                  <label className="t-field">
                    <span className="t-sr">Name</span>
                    <input
                      className="t-input" value={c.name} placeholder="Name"
                      onChange={(e) => setChar(c.id, { name: e.target.value })}
                    />
                  </label>
                  <label className="t-field">
                    <span className="t-sr">Class</span>
                    <input
                      className="t-input" value={c.cls} placeholder="Class"
                      onChange={(e) => setChar(c.id, { cls: e.target.value })}
                    />
                  </label>
                  <div className="t-mods">
                    {SCORES.map((s) => (
                      <label className="t-mod" key={s}>
                        <span className="t-mod__label">{s}</span>
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
              <button
                type="button" className="t-char t-char--add"
                onClick={() => set('roster', [...campaign.roster, blankCharacter()])}
              >
                <span className="t-char__order t-char__order--ghost" />
                <span>Add a seat</span>
              </button>
            </div>
          </section>

          <div className="t-stack">
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
              {/* What the shuffle will hold, live: the two extra dials
                  move these counts. This is the part of the old deck
                  reference card the creator actually needs; the rest of
                  it, and all of the loop card, is how the game plays,
                  which the landing page covers. */}
              <div className="t-deck" aria-label="What the deck holds">
                <span className="t-kicker">{deckSize} cards in the deck</span>
                <ul className="t-deck__list">
                  {CANONICAL_CATEGORIES.map((c) => {
                    const extra = c.category === 'clear-path' ? campaign.extraClearPath
                      : c.category === 'monster' ? campaign.extraMonster : 0;
                    const local = cardName(biome, c.category);
                    return (
                      <li key={c.category} className={`t-deck__cat ${CATEGORY_CLASS[c.category]}`}>
                        <span className="t-deck__count">{c.copies + extra}</span>
                        <span className="t-deck__name">{c.title}</span>
                        {local !== c.title ? <span className="t-deck__local">{local}</span> : null}
                      </li>
                    );
                  })}
                </ul>
                <p className="t-note">
                  The Monsters are the dial that actually bites — two strikes
                  and the party is found. Raising the DC changes surprisingly
                  little, because a failed action still lets you take a path.
                </p>
              </div>
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
        </div>
      </div>
    </>
  );
}
