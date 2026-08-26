import type {
  EmulatorEngine,
  Resolution,
} from "../types";

// Second backend for 64-bit / ARM guests. Not functional yet — the WASM build
// it depends on is documented in docs/qemu-wasm.md and is a large, separate
// infrastructure effort. The class exists so the rest of MalMox (Console,
// store, persistence) can already treat engines uniformly via EmulatorEngine.
//
// When the wasm build lands, implement each method against the QEMU WASM
// runtime: load qemu-system-x86_64.wasm, expose the disk as a chunked
// IndexedDB block device, render VGA to screenContainer, and bridge
// serial/keyboard/mouse through EngineHandles.

const NOT_BUILT =
  "QEMU-WASM backend is not built. See docs/qemu-wasm.md for the build recipe.";

export interface QemuOptions {
  // populated once the wasm module + bios are available at /emulator/qemu/
  wasmUrl?: string;
  biosUrl?: string;
  vgaBiosUrl?: string;
}

export class QemuEngine implements EmulatorEngine {
  constructor(_opts: QemuOptions = {}) {}

  private fail(): never {
    throw new Error(NOT_BUILT);
  }

  start(): Promise<void> {
    return this.fail();
  }
  powerOff(): Promise<void> {
    return this.fail();
  }
  reset(): void {
    this.fail();
  }
  ctrlAltDel(): void {
    this.fail();
  }
  fullscreen(): void {
    this.fail();
  }
  screenshot(): HTMLElement | null {
    return this.fail();
  }
  insertIso(_buffer: ArrayBuffer): Promise<void> {
    return this.fail();
  }
  ejectIso(): void {
    this.fail();
  }
  sendText(_text: string): void {
    this.fail();
  }
  keyboardEnabled(_v: boolean): void {
    this.fail();
  }
  mouseEnabled(_v: boolean): void {
    this.fail();
  }
  lockMouse(): void {
    this.fail();
  }
  isRunning(): boolean {
    return false;
  }
  snapshot(_final?: boolean): Promise<void> {
    return this.fail();
  }
  discardSnapshot(): Promise<void> {
    return this.fail();
  }
  setScale(_zoom: number): void {
    this.fail();
  }
  fitToContainer(): void {
    this.fail();
  }
  getResolution(): Resolution | null {
    return null;
  }
}
