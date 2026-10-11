/* ============================================================
   The page's side of the world's worker (paint.worker.ts): build a
   side's design at a size, then ask for its picture at a moment. One
   frame is drawn at a time; a request made while one is being drawn
   waits, and a newer one replaces it. Buffers go back and forth
   rather than being made per frame.
   ============================================================ */

import type { Side } from '@maze-deck/art';
import type { FromPainter, ToPainter } from './paint.worker';

export class WorldPainter {
  private worker: Worker;
  private build = 0;
  private size = 0;
  private built = false;
  private busy = false;
  private next: { t: number; gutter: number } | null = null;
  private spare: ArrayBuffer[] = [];
  private done: (() => void) | null = null;

  /** `onFrame` is given each new picture, RGBA, top row first; it is only lent. */
  constructor(private onFrame: (pixels: Uint8Array) => void, onFailed: (message: string) => void) {
    this.worker = new Worker(new URL('./paint.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<FromPainter>) => {
      const m = e.data;
      if (m.build !== this.build) {
        if (m.type === 'frame') this.busy = false;
        return;
      }
      if (m.type === 'built') {
        this.built = true;
        this.done?.();
        this.done = null;
      } else if (m.type === 'failed') {
        onFailed(m.message);
      } else {
        this.busy = false;
        if (m.painted) this.onFrame(new Uint8Array(m.buffer));
        if (m.buffer.byteLength === this.size) this.spare.push(m.buffer);
        const n = this.next;
        this.next = null;
        if (n) this.request(n.t, n.gutter);
      }
    };
    this.worker.onerror = (e) => { e.preventDefault(); onFailed(e.message || 'The world could not be drawn'); };
  }

  /** Build a side's design at W x H. Resolves when it is ready to draw. */
  load(setting: string, side: Side, W: number, H: number, gutter: boolean): Promise<void> {
    this.build += 1;
    this.size = W * H * 4;
    this.built = false;
    this.next = null;
    this.spare = [];
    const msg: ToPainter = { type: 'build', build: this.build, setting, side, W, H, gutter };
    this.worker.postMessage(msg);
    return new Promise((resolve) => { this.done = resolve; });
  }

  /** Ask for the picture at `t`, its lights guttering by `gutter`. */
  request(t: number, gutter: number): void {
    if (!this.built) return;
    if (this.busy) { this.next = { t, gutter }; return; }
    const buffer = this.spare.pop() ?? new ArrayBuffer(this.size);
    const msg: ToPainter = { type: 'frame', build: this.build, t, gutter, buffer };
    this.busy = true;
    this.worker.postMessage(msg, [buffer]);
  }

  dispose(): void {
    this.worker.terminate();
    this.done = null;
  }
}
