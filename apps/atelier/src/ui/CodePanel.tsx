import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { copyText, download, pngBlob, svgText } from '../core/export';
import { Button } from './controls';

export interface ExportSpec {
  /** The picture, with a viewBox and no size. */
  node: ReactElement;
  width: number;
  height: number;
  /** Nearest-neighbour when rasterising. */
  pixelated?: boolean;
}

/**
 * The right-hand column: what to paste, and the buttons that take
 * the picture out of the browser.
 */
export function CodePanel({ title, note, code, stem, svg, children }: {
  title: string;
  note?: ReactNode;
  code: string;
  stem: string;
  svg?: ExportSpec;
  children?: ReactNode;
}) {
  const [status, setStatus] = useState<string>('');
  const say = (s: string) => { setStatus(s); window.setTimeout(() => setStatus(''), 2200); };

  const onCopy = async () => say((await copyText(code)) ? 'Copied.' : 'Clipboard refused — select the text instead.');
  const onSvg = () => {
    if (!svg) return;
    download(`${stem}.svg`, svgText(svg.node, svg.width, svg.height), 'image/svg+xml');
    say('SVG saved.');
  };
  const onPng = async () => {
    if (!svg) return;
    try {
      const blob = await pngBlob(svgText(svg.node, svg.width, svg.height), svg.width, svg.height, svg.pixelated);
      download(`${stem}.png`, blob);
      say(`PNG saved, ${svg.width} × ${svg.height}.`);
    } catch (e) {
      say(`PNG failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="atl-codepanel">
      <h3 className="atl-section__title">{title}</h3>
      {note ? <p className="atl-note">{note}</p> : null}
      <div className="atl-actions">
        <Button onClick={onCopy} primary>Copy</Button>
        {svg ? <Button onClick={onSvg}>SVG</Button> : null}
        {svg ? <Button onClick={onPng}>PNG</Button> : null}
        <span className="atl-status" aria-live="polite">{status}</span>
      </div>
      {children}
      <pre className="atl-code"><code>{code}</code></pre>
    </div>
  );
}
