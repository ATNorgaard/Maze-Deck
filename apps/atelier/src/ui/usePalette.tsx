import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FALLBACK_PALETTE, readPalette } from '../core/biomes';
import type { BiomeId, Palette } from '../core/biomes';

/**
 * The biome's real palette, read off the CSS.
 *
 * Renders an invisible `.md-root` under the right `data-biome` and
 * reads the custom properties back, so the generators draw with the
 * same hex values the table app uses — and a change to biomes.css
 * shows up here on the next hot reload with nothing to sync.
 */
export function usePalette(biome: BiomeId): { palette: Palette; probe: ReactNode } {
  const ref = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState<Palette>(FALLBACK_PALETTE);
  useLayoutEffect(() => {
    if (ref.current) setPalette(readPalette(ref.current));
  }, [biome]);
  const probe = (
    <div data-biome={biome} aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <div className="md-root" ref={ref} />
    </div>
  );
  return { palette, probe };
}
