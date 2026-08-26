export type OsFamily = "busybox" | "musl" | "glibc" | "pacman" | "dos" | "asm" | "other";
export type AssetRole = "cdrom" | "hda" | "floppy" | "bzimage" | "initrd";

export interface BootAsset {
  role: AssetRole;
  file: string;
}

export type BootKind = "iso" | "disk" | "kernel";

export interface CatalogEntry {
  id: string;
  label: string;
  category: "tiny" | "linux" | "retro";
  family: OsFamily;
  description: string;
  sizeMB: number;
  gui: boolean;
  display: "serial" | "canvas";
  boot: BootKind;
  assets: BootAsset[];
  cmdline?: string;
  upstream: string;
  version: string;
}

export interface Manifest {
  rev: number;
  generatedAt: string;
  baseUrls: { releases: string };
  systems: CatalogEntry[];
}

export type BootMode = "terminal" | "desktop";

export type NetBackend = "off" | "lan" | "fetch" | "wisp";
export type NicType = "ne2k" | "virtio";

export interface HardwareConfig {
  ramMB: number;
  vgaMB: number;
  diskMB: number;
  acpi: boolean;
  speaker: boolean;
  disableJit: boolean;
  nicType: NicType;
  netBackend: NetBackend;
  gatewayUrl: string;
  corsProxy: string;
  doh: boolean;
}

export interface SystemMeta {
  id: string; // catalog entry id (unique per install)
  label: string;
  family: OsFamily;
  version: string;
  installedAt: number;
  sizeBytes: number;
  hardware: HardwareConfig;
  display: "serial" | "canvas";
  assets?: Partial<Record<AssetRole, number>>;
  lastBootMode?: BootMode;
  snapshotAt?: number;
}

export const RAM_PRESETS = [64, 128, 256, 512, 1024];

export const DEFAULT_HW: HardwareConfig = {
  ramMB: 256,
  vgaMB: 16,
  diskMB: 512,
  acpi: false,
  speaker: false,
  disableJit: false,
  nicType: "virtio",
  netBackend: "fetch",
  gatewayUrl: "",
  corsProxy: "",
  doh: true,
};

export const FAMILY_LABEL: Record<OsFamily, string> = {
  busybox: "BusyBox",
  musl: "musl",
  glibc: "glibc",
  pacman: "pacman",
  dos: "DOS",
  asm: "asm",
  other: "other",
};
