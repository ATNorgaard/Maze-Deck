import type * as React from 'react';
import { CardBack } from '@maze-deck/ui';
import type { CardSize } from '@maze-deck/ui';
import type { Biome } from '../biomes';
import { MOTION } from '../stage/motion';

/**
 * The crossing's name over the setting's horizon, as a crossing begins
 * (docs/overhaul.md, phase 7). Sits in the stage, over the vista, which
 * before the first card turns is the setting at rest. It rises, holds
 * and goes on its own clock; any input ends the whole opening.
 */
export function OpeningTitle({ biome, runName }: { biome: Biome; runName: string }) {
  const style = { '--ms': `${MOTION.openTitle}ms` } as React.CSSProperties;
  return (
    <div className="t-opening" aria-hidden="true" style={style}>
      <p className="t-kicker t-opening__kicker">{biome.name}</p>
      <h2 className="t-opening__title">{runName}</h2>
      <p className="t-opening__flavour">{biome.flavour}</p>
      <p className="t-opening__skip">Any key to begin</p>
    </div>
  );
}

const RIFFLE = 6;

/**
 * The deck shuffled before it is dealt from: its top cards split into two
 * packets either side of the pile and riffle back together, over the
 * pile's own top card. Backs only; transforms only.
 */
export function Riffle({ rect, size }: { rect: DOMRect; size: CardSize }) {
  return (
    <div
      className="t-riffle"
      aria-hidden="true"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, '--ms': `${MOTION.riffle}ms` } as React.CSSProperties}
    >
      {Array.from({ length: RIFFLE }, (_, i) => (
        <div
          key={i}
          className="t-riffle__card"
          data-side={i % 2 ? 'right' : 'left'}
          style={{ '--i': Math.floor(i / 2) } as React.CSSProperties}
        >
          <CardBack size={size} />
        </div>
      ))}
    </div>
  );
}
