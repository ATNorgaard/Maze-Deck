import * as React from 'react';

/**
 * Where Radix is allowed to portal to.
 *
 * Radix portals to `document.body` by default, and every design token
 * lives on `.md-root` — the element `MazeDeckProvider` emits inside the
 * app tree. Anything portalled to the body lands outside that scope and
 * paints unstyled: no palette, no fonts, no `--md-u`.
 *
 * So we mount an empty host as the last child *inside* the provider and
 * hand it to every `Radix.Portal`. Overlays still escape their parent's
 * stacking and overflow, which is the whole point of portalling, but
 * they stay inside the cascade that styles them.
 */
const PortalContext = React.createContext<HTMLElement | null>(null);

export function PortalHost({ children }: { children: React.ReactNode }) {
  // State, not a ref: the first render has no node, and consumers must
  // re-render once it exists or their portals never mount.
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);

  return (
    <PortalContext.Provider value={node}>
      {children}
      <div ref={setNode} />
    </PortalContext.Provider>
  );
}

/** The element Radix overlays should portal into. Null on first render. */
export function usePortalContainer(): HTMLElement | null {
  return React.useContext(PortalContext);
}
