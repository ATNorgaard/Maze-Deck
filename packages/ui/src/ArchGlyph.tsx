import * as React from 'react';
import type { ArchState } from './types';

/* ============================================================
   ARCH GLYPH
   One motif, twelve states. Every card category and every
   ability is THE SAME DOORWAY; only what stands in it changes.

   Deck states       Clear Path / Dead End / Obstacle / Trap /
                     Monster / Wanderer / Item
   Ability states    Forge a Path / Scout Ahead / It's Elementary /
                     Careful Consideration / Boost Morale
   Neutral           Seal (card back only — carries no category)

   Drawn on a 120x140 grid, currentColor only.

   Every glyph inlines its own arch band and clip path rather
   than sharing a <defs> sprite. Shared SVG ids collide the
   moment two instances mount, and a broken clipPath silently
   renders an EMPTY arch — the failure is invisible until
   someone looks. Duplicated path data is the cheaper bug.
   ============================================================ */

const BAND =
  'M16,132 L16,70 A44,44 0 0 1 104,70 L104,132 L92,132 L92,70 A32,32 0 0 0 28,70 L28,132 Z';
const OPENING = 'M28,132 L28,70 A32,32 0 0 1 92,70 L92,132 Z';

let uid = 0;

/** Interior artwork per state, drawn inside the arch opening. */
function interior(state: ArchState): React.ReactNode {
  switch (state) {
    case 'clear-path':
      return (
        <>
          <g fill="none" stroke="currentColor" strokeLinecap="square">
            <path d="M38,132 L38,84 A22,22 0 0 1 82,84 L82,132" strokeWidth="3.4" opacity=".85" />
            <path d="M47,132 L47,95 A13,13 0 0 1 73,95 L73,132" strokeWidth="2.8" opacity=".6" />
            <path d="M54,132 L54,104 A6,6 0 0 1 66,104 L66,132" strokeWidth="2.2" opacity=".4" />
          </g>
          <circle cx="60" cy="118" r="7" fill="currentColor" opacity=".9" />
        </>
      );

    case 'dead-end':
      return (
        <g stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="square">
          <path d="M24,80 H96 M24,93 H96 M24,106 H96 M24,119 H96" />
          <path d="M44,68 V80 M60,68 V80 M76,68 V80" />
          <path d="M36,80 V93 M52,80 V93 M68,80 V93 M84,80 V93" />
          <path d="M44,93 V106 M60,93 V106 M76,93 V106" />
          <path d="M36,106 V119 M52,106 V119 M68,106 V119 M84,106 V119" />
          <path d="M44,119 V132 M60,119 V132 M76,119 V132" />
        </g>
      );

    /* Descends from the top. Trap springs from the floor — the
       opposite direction of travel is what keeps the two
       blockers apart at 12mm. */
    case 'obstacle':
      return (
        <g fill="currentColor">
          <rect x="24" y="66" width="72" height="7" rx="1" />
          <rect x="34" y="70" width="4.5" height="34" /><path d="M32,104 h8.5 L36.2,115 Z" />
          <rect x="46" y="70" width="4.5" height="38" /><path d="M44,108 h8.5 L48.2,119 Z" />
          <rect x="58" y="70" width="4.5" height="34" /><path d="M56,104 h8.5 L60.2,115 Z" />
          <rect x="70" y="70" width="4.5" height="38" /><path d="M68,108 h8.5 L72.2,119 Z" />
          <rect x="82" y="70" width="4.5" height="34" /><path d="M80,104 h8.5 L84.2,115 Z" />
          <rect x="24" y="79" width="72" height="4" rx="1" opacity=".85" />
          <rect x="24" y="94" width="72" height="4" rx="1" opacity=".85" />
        </g>
      );

    case 'trap':
      return (
        <g fill="currentColor">
          <rect x="28" y="86" width="64" height="2.6" rx="1.3" opacity=".8" />
          <rect x="29" y="79" width="4" height="16" rx="1" />
          <rect x="87" y="79" width="4" height="16" rx="1" />
          <path d="M33,132 L39,104 L45,132 Z" />
          <path d="M47,132 L53,99 L59,132 Z" />
          <path d="M61,132 L67,99 L73,132 Z" />
          <path d="M75,132 L81,104 L87,132 Z" />
        </g>
      );

    case 'monster':
      return (
        <>
          <g fill="currentColor">
            <path d="M36,92 Q47,86 57,99 Q45,105 36,92 Z" />
            <path d="M84,92 Q73,86 63,99 Q75,105 84,92 Z" />
          </g>
          <path
            d="M40,116 L47,124 L54,116 L60,124 L66,116 L73,124 L80,116"
            fill="none" stroke="currentColor" strokeWidth="2.6"
            strokeLinecap="square" opacity=".75"
          />
        </>
      );

    /* The face is cut as a real hole (fill-rule evenodd) rather
       than painted dark, so the figure stays a silhouette on
       any ground. */
    case 'wanderer':
      return (
        <>
          <rect x="79.5" y="64" width="3.4" height="68" fill="currentColor" opacity=".9" />
          <circle cx="81.2" cy="59" r="4.2" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <path
            fill="currentColor" fillRule="evenodd"
            d="M45,84 A11,11 0 0 1 67,84 L74,132 L38,132 Z
               M51,82 a5,5.5 0 1 0 10,0 a5,5.5 0 1 0 -10,0 Z"
          />
        </>
      );

    case 'item':
      return (
        <>
          <g stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" fill="none" opacity=".8">
            <path d="M60,84 L60,72" /><path d="M43,88 L35,78" /><path d="M77,88 L85,78" />
          </g>
          <g fill="currentColor">
            <path d="M33,103 L33,99 A27,8 0 0 1 87,99 L87,103 Z" />
            <rect x="36" y="106" width="48" height="25" />
            <rect x="55" y="100" width="10" height="13" rx="1" />
          </g>
        </>
      );

    /* ---- abilities: the tool the character brings ---- */

    case 'forge-a-path':
      return (
        <g fill="currentColor">
          <g stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" opacity=".75">
            <path d="M44,58 L40,50" /><path d="M76,58 L80,50" />
          </g>
          <path d="M34,66 L86,66 L86,88 L34,88 Z" />
          <path d="M34,68 L25,74 L25,80 L34,86 Z" />
          <rect x="55" y="88" width="10" height="44" rx="2" />
        </g>
      );

    case 'scout-ahead':
      return (
        <>
          <g stroke="currentColor" fill="none">
            <circle cx="60" cy="56" r="7" strokeWidth="3" />
            <g strokeWidth="3.2" strokeLinecap="round" opacity=".7">
              <path d="M38,92 L29,88" /><path d="M82,92 L91,88" />
            </g>
          </g>
          <g fill="currentColor">
            <rect x="58.5" y="62" width="3" height="10" />
            <path d="M46,72 L74,72 L70,79 L50,79 Z" />
            <path d="M50,79 L70,79 L72,110 L48,110 Z" />
            <rect x="45" y="110" width="30" height="6" rx="1" />
          </g>
        </>
      );

    case 'its-elementary':
      return (
        <g fill="none" stroke="currentColor">
          <circle cx="54" cy="80" r="19" strokeWidth="6" />
          <path d="M67,94 L84,117" strokeWidth="9" strokeLinecap="round" />
          <path d="M46,72 L42,78" strokeWidth="3" strokeLinecap="round" opacity=".7" />
        </g>
      );

    case 'careful-consideration':
      return (
        <g fill="currentColor">
          <rect x="58" y="66" width="4" height="60" />
          <rect x="46" y="126" width="28" height="5" rx="1" />
          <rect x="34" y="76" width="52" height="4" rx="2" />
          <rect x="37" y="80" width="2.4" height="10" />
          <rect x="80.6" y="80" width="2.4" height="10" />
          <path d="M30,90 L46,90 L42,99 L34,99 Z" />
          <path d="M74,90 L90,90 L86,99 L78,99 Z" />
        </g>
      );

    case 'boost-morale':
      return (
        <g fill="currentColor">
          <circle cx="42.2" cy="55" r="3.6" />
          <rect x="40" y="58" width="4.5" height="74" />
          <path d="M44.5,63 L84,63 L76,75 L84,87 L44.5,87 Z" />
        </g>
      );

    case 'steel-yourself':
      return (
        <>
          <path
            d="M60,52 L87,62 L87,91 C87,111 75,126 60,133 C45,126 33,111 33,91 L33,62 Z"
            fill="none" stroke="currentColor" strokeWidth="4.4" strokeLinejoin="round"
          />
          <g fill="currentColor">
            <path d="M60,68 L74,78 L60,88 L46,78 Z" />
            <rect x="43" y="95" width="34" height="5.5" rx="1" />
          </g>
        </>
      );

    case 'seal':
      return null;
  }
}

export interface ArchGlyphProps {
  /** Which doorway state to draw. */
  state: ArchState;
  /** Accessible label. Omit to mark the glyph decorative (the default). */
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The design system's single icon primitive. Renders the shared
 * arch with one state's interior, in `currentColor`.
 */
export function ArchGlyph({ state, title, className, style }: ArchGlyphProps) {
  const clipId = React.useMemo(() => `md-arch-clip-${(uid += 1)}`, []);

  // The card back's seal is an outline medallion, not a filled arch.
  if (state === 'seal') {
    return (
      <svg viewBox="0 0 120 140" className={className} style={style}
           role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
        {title ? <title>{title}</title> : null}
        <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="square">
          <path d={OPENING} />
          <path d="M16,132 L16,70 A44,44 0 0 1 104,70 L104,132" />
          <path d="M4,134 H116" />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 140" className={className} style={style}
         role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <defs>
        <clipPath id={clipId}><path d={OPENING} /></clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>{interior(state)}</g>
      <path d={BAND} fill="currentColor" fillRule="evenodd" />
      <g fill="currentColor">
        <rect x="8" y="132" width="104" height="7" rx="1" />
        <rect x="4" y="130" width="112" height="2.6" rx="1" opacity=".55" />
      </g>
    </svg>
  );
}
