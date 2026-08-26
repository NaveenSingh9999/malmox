// Contract every emulator backend in MalMox must satisfy.
// v86 implements this today (see V86Engine in ../engine.ts); a future
// QEMU-WASM backend will implement the same surface so the UI, store and
// persistence layers never have to care which engine is running.
//
// Methods marked (optional) may be no-ops on engines that lack the feature.

export interface Resolution {
  w: number;
  h: number;
}

export interface EmulatorEngine {
  start(): Promise<void>;
  powerOff(): Promise<void>;
  reset(): void;
  ctrlAltDel(): void;
  fullscreen(): void;
  /** Returns an <img> for VGA/desktop engines, null for serial-only. */
  screenshot(): HTMLElement | null;
  insertIso(buffer: ArrayBuffer): Promise<void>;
  ejectIso(): void;
  sendText(text: string): void;
  keyboardEnabled(v: boolean): void;
  mouseEnabled(v: boolean): void;
  lockMouse(): void;
  isRunning(): boolean;
  snapshot(final?: boolean): Promise<void>;
  discardSnapshot(): Promise<void>;

  /** Integer or fractional canvas scale (crisp pixelated rendering). */
  setScale(zoom: number): void;
  /** Fit the guest framebuffer to the current container (max integer scale). */
  fitToContainer(): void;
  /** Current guest framebuffer size, or null if unknown/serial. (optional) */
  getResolution?(): Resolution | null;
}
