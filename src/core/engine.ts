import { V86 } from "v86";
import type { SystemMeta, BootMode, HardwareConfig } from "./types";
import { gzip, gunzip } from "./binutil";
import { loadSnapshotGz, saveSnapshotGz, clearSnapshot } from "./db";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

export interface BootAssets {
  cdrom?: ArrayBuffer;
  hda?: ArrayBuffer;
  bzimage?: ArrayBuffer;
  initrd?: ArrayBuffer;
}

export interface EngineHandles {
  term: Terminal;
  fit: FitAddon;
  screenContainer: HTMLElement;
}

export interface EngineEvents {
  onStatus?: (s: "booting" | "running" | "stopped" | "error") => void;
  onError?: (msg: string) => void;
  onSnapshot?: (at: number) => void;
}

function netDevice(hw: HardwareConfig) {
  switch (hw.netBackend) {
    case "lan":
      return { type: hw.nicType, relay_url: "inbrowser" };
    case "fetch":
      return {
        type: hw.nicType,
        relay_url: "fetch",
        cors_proxy: hw.corsProxy || undefined,
        dns_method: hw.doh ? ("doh" as const) : ("static" as const),
      };
    case "wisp":
      return {
        type: hw.nicType,
        relay_url: hw.gatewayUrl || "wisp://localhost",
        dns_method: hw.doh ? ("doh" as const) : ("static" as const),
      };
    default:
      return null;
  }
}

export class MalmoxEngine {
  private emulator: V86 | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private autosaveTimer: number | null = null;
  private haltTimer: number | null = null;
  private lastCounter = 0;
  private stallTicks = 0;
  private poweringDown = false;
  private poweredOff = false;
  private visibilityHandler = () => {
    void this.reacquireWakeLock();
  };

  constructor(
    private meta: SystemMeta,
    private mode: BootMode,
    private assets: BootAssets,
    private handles: EngineHandles,
    private events: EngineEvents = {},
  ) {}

  async start(): Promise<void> {
    this.events.onStatus?.("booting");
    const hw = this.meta.hardware;

    const snap = await loadSnapshotGz(this.meta.id);
    let initialState: { buffer: ArrayBuffer } | undefined;
    if (snap) {
      try {
        initialState = { buffer: await gunzip(snap.gz) };
      } catch {
        await clearSnapshot(this.meta.id);
      }
    }

    const opts: ConstructorParameters<typeof V86>[0] = {
      wasm_path: "/emulator/v86.wasm",
      memory_size: hw.ramMB * 1024 * 1024,
      vga_memory_size: hw.vgaMB * 1024 * 1024,
      bios: { url: "/emulator/bios/seabios.bin" },
      vga_bios: { url: "/emulator/bios/vgabios.bin" },
      autostart: true,
      acpi: hw.acpi,
      disable_speaker: !hw.speaker,
      disable_jit: hw.disableJit,
      screen: {
        container: this.handles.screenContainer,
        use_graphical_text: false,
      },
      serial_console: {
        type: "xtermjs",
        container: this.handles.term.element!,
        xterm_lib: Terminal as unknown as Function,
      },
      net_device: netDevice(hw) ?? undefined,
    };

    if (initialState) {
      opts.initial_state = initialState;
    } else {
      const a = this.assets;
      if (a.cdrom && a.hda) {
        opts.hda = { buffer: a.hda };
        opts.cdrom = { buffer: a.cdrom };
        opts.boot_order = 0x123; // CD → HD
      } else if (a.hda) {
        opts.hda = { buffer: a.hda };
      } else if (a.cdrom) {
        opts.cdrom = { buffer: a.cdrom };
      }
      if (a.bzimage) {
        opts.bzimage = { buffer: a.bzimage };
        opts.cmdline =
          this.mode === "desktop"
            ? `root=/dev/sda rw quiet console=tty0`
            : `root=/dev/sda rw console=ttyS0 tsc=reliable`;
        if (a.initrd) opts.initrd = { buffer: a.initrd };
      }
    }

    try {
      this.emulator = new V86(opts);
    } catch (e) {
      this.events.onStatus?.("error");
      this.events.onError?.(String(e));
      return;
    }

    this.emulator.add_listener("emulator-started", () => {
      this.events.onStatus?.("running");
      void this.acquireWakeLock();
      this.startAutosave();
      this.startHaltWatch();
    });
    this.emulator.add_listener("emulator-stopped", () => {
      this.events.onStatus?.("stopped");
      this.stopAutosave();
      this.stopHaltWatch();
      void this.releaseWakeLock();
    });
    document.addEventListener("visibilitychange", this.visibilityHandler);
    window.addEventListener("pagehide", this.pageHide);
  }

  // Guests without ACPI (our default) simply halt on `poweroff`. v86 never
  // emits emulator-stopped in that case — detect the frozen instruction
  // counter and treat it as a clean halt so the UI and snapshots behave.
  private startHaltWatch() {
    this.stopHaltWatch();
    this.lastCounter = -1;
    this.stallTicks = 0;
    this.haltTimer = window.setInterval(() => {
      if (!this.emulator?.is_running()) return;
      const c = this.emulator.get_instruction_counter();
      if (c === this.lastCounter) {
        this.stallTicks++;
        if (this.stallTicks >= 3) {
          this.stallTicks = 0;
          this.events.onStatus?.("stopped"); // halted by guest
          void this.snapshot(true);
        }
      } else {
        this.stallTicks = 0;
        this.lastCounter = c;
      }
    }, 1500);
  }

  private stopHaltWatch() {
    if (this.haltTimer !== null) {
      clearInterval(this.haltTimer);
      this.haltTimer = null;
    }
  }

  private pageHide = () => {
    void this.snapshot(true);
  };

  private startAutosave() {
    this.stopAutosave();
    this.autosaveTimer = window.setInterval(() => {
      void this.snapshot(false);
    }, 120_000);
  }

  private stopAutosave() {
    if (this.autosaveTimer !== null) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  async snapshot(final: boolean): Promise<void> {
    if (!this.emulator || this.poweringDown && !final) return;
    if (!this.emulator.is_running()) return;
    try {
      const state = await this.emulator.save_state();
      const gz = await gzip(state);
      await saveSnapshotGz(this.meta.id, state, gz);
      this.events.onSnapshot?.(Date.now());
      if (final) {
        this.poweringDown = true;
        await this.emulator.stop();
      }
    } catch (e) {
      if (
        e instanceof DOMException &&
        /quota|storage/i.test(String(e?.name ?? "") + String(e))
      ) {
        this.events.onError?.(
          "Storage full — snapshot not saved. Free space in Settings.",
        );
      }
      /* other snapshot failures stay best-effort */
    }
  }

  async powerOff(): Promise<void> {
    if (this.poweredOff) return;
    this.poweredOff = true;
    this.poweringDown = true;
    this.stopAutosave();
    this.stopHaltWatch();
    try {
      if (this.emulator?.is_running()) {
        const state = await this.emulator.save_state();
        const gz = await gzip(state);
        await saveSnapshotGz(this.meta.id, state, gz);
        this.events.onSnapshot?.(Date.now());
        await this.emulator.stop();
      }
    } catch {
      /* best-effort */
    }
    try {
      await this.emulator?.destroy();
    } catch {
      /* noop */
    }
    this.emulator = null;
    await this.releaseWakeLock();
    document.removeEventListener("visibilitychange", this.visibilityHandler);
    window.removeEventListener("pagehide", this.pageHide);
  }

  reset(): void {
    this.emulator?.restart();
  }

  ctrlAltDel(): void {
    this.emulator?.keyboard_send_scancodes([0x1d, 0x38, 0x53, 0xd3, 0xb8, 0x9d]);
  }

  fullscreen(): void {
    this.emulator?.screen_go_fullscreen();
  }

  screenshot(): HTMLElement | null {
    try {
      return this.emulator?.screen_make_screenshot() ?? null;
    } catch {
      return null;
    }
  }

  insertIso(buffer: ArrayBuffer): Promise<void> {
    return this.emulator!.set_cdrom({ buffer });
  }

  ejectIso(): void {
    this.emulator?.eject_cdrom();
  }

  sendText(text: string): void {
    this.emulator?.serial0_send(text);
  }

  keyboardEnabled(v: boolean): void {
    this.emulator?.keyboard_set_enabled(v);
  }

  mouseEnabled(v: boolean): void {
    this.emulator?.mouse_set_enabled(v);
  }

  lockMouse(): void {
    this.emulator?.lock_mouse();
  }

  isRunning(): boolean {
    return this.emulator?.is_running() ?? false;
  }

  discardSnapshot(): Promise<void> {
    return clearSnapshot(this.meta.id);
  }

  private async acquireWakeLock(): Promise<void> {
    if (localStorage.getItem("malmox.wakelock") === "0") return;
    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
      this.wakeLock.addEventListener("release", () => {
        this.wakeLock = null;
      });
    } catch {
      /* denied or unsupported */
    }
  }

  private async reacquireWakeLock(): Promise<void> {
    if (document.visibilityState === "visible" && !this.wakeLock && this.isRunning()) {
      await this.acquireWakeLock();
    }
  }

  private async releaseWakeLock(): Promise<void> {
    try {
      await this.wakeLock?.release();
    } catch {
      /* noop */
    }
    this.wakeLock = null;
  }
}
