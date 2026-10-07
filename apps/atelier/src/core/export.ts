/* ============================================================
   Getting the artwork out.

   Everything the atelier draws is a React SVG element with only
   a viewBox, no width or height and no CSS variables, so the
   same element previews in the page and serialises to a
   standalone file. The exporter injects the pixel size.
   ============================================================ */

import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/** Standalone SVG text. The root gains an xmlns and a pixel size. */
export function svgText(node: ReactElement, width?: number, height?: number): string {
  let s = renderToStaticMarkup(node);
  if (!s.startsWith('<svg')) throw new Error('svgText: not an <svg> root');
  const attrs = ['xmlns="http://www.w3.org/2000/svg"'];
  if (width !== undefined && height !== undefined) attrs.push(`width="${width}" height="${height}"`);
  s = s.replace(/^<svg/, `<svg ${attrs.join(' ')}`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${s}\n`;
}

/** A `data:` URI for use inside CSS `url()`. */
export function svgDataUri(node: ReactElement, width: number, height: number): string {
  const s = renderToStaticMarkup(node)
    .replace(/^<svg/, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`);
  return `data:image/svg+xml;utf8,${encodeURIComponent(s).replace(/%20/g, ' ')}`;
}

/** Rasterise an SVG string to a PNG blob at exactly w × h pixels. */
export async function pngBlob(svg: string, w: number, h: number, pixelated = false): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('The SVG did not load as an image'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d context');
    ctx.imageSmoothingEnabled = !pixelated;
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function download(name: string, data: Blob | string, mime = 'text/plain'): void {
  const blob = typeof data === 'string' ? new Blob([data], { type: `${mime};charset=utf-8` }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** A safe file stem from free text. */
export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}
