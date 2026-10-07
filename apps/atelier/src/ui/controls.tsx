/* The atelier's own controls. Small, unstyled beyond atelier.css. */

import type { ReactNode } from 'react';
import { seedWord } from '@maze-deck/art';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="atl-field">
      <span className="atl-field__label">{label}</span>
      {children}
      {hint ? <span className="atl-field__hint">{hint}</span> : null}
    </label>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="atl-section">
      <h3 className="atl-section__title">{title}</h3>
      {children}
    </section>
  );
}

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
}

export function Slider({ label, value, min, max, step = 0.01, onChange, format, hint }: SliderProps) {
  return (
    <Field label={`${label} · ${format ? format(value) : String(Math.round(value * 100) / 100)}`} hint={hint}>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  );
}

export interface Option<T extends string> { id: T; name: string; blurb?: string }

export function Select<T extends string>({ label, value, options, onChange, hint }: {
  label: string; value: T; options: readonly Option<T>[]; onChange: (v: T) => void; hint?: string;
}) {
  const current = options.find((o) => o.id === value);
  return (
    <Field label={label} hint={hint ?? current?.blurb}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </Field>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: readonly Option<T>[]; onChange: (v: T) => void; label?: string;
}) {
  return (
    <div className="atl-seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={o.id === value}
          className="atl-seg__item" data-active={o.id === value || undefined}
          onClick={() => onChange(o.id)} title={o.blurb}>
          {o.name}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="atl-toggle">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function TextInput({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
    </Field>
  );
}

export function NumberInput({ label, value, onChange, min, max, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number;
}) {
  return (
    <Field label={label}>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(n); }} />
    </Field>
  );
}

export function Seed({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="atl-seed">
      <Field label="Seed">
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      </Field>
      <button type="button" className="atl-btn" onClick={() => onChange(seedWord())} title="A new seed">
        Reroll
      </button>
    </div>
  );
}

export function Button({ children, onClick, primary, disabled, title }: {
  children: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean; title?: string;
}) {
  return (
    <button type="button" className="atl-btn" data-primary={primary || undefined} disabled={disabled} onClick={onClick} title={title}>
      {children}
    </button>
  );
}
