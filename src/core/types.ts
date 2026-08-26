export type OsId = "buildroot" | "alpine" | "debian" | "arch";

export type BootMode = "terminal" | "desktop";

export type NetBackend = "off" | "lan" | "fetch" | "wisp";
export type NicType = "ne2k" | "virtio";

export interface HardwareConfig {
  ramMB: number;
  vgaMB: number;
  diskMB: number;
  bootOrder: number;
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
  id: string;
  os: OsId;
  label: string;
  version: string;
  installedAt: number;
  sha256: string;
  sizeBytes: number;
  hardware: HardwareConfig;
  lastBootMode?: BootMode;
  snapshotAt?: number;
}

export interface CatalogEntry {
  os: OsId;
  label: string;
  description: string;
  family: "busybox" | "musl" | "glibc" | "pacman";
  downloadMB: number;
  diskMB: number;
  ramMB: number;
  bootSeconds: string;
  gui: boolean;
  url: string;
  sha256Url: string;
  bzimage: string;
  initrd: string;
  version: string;
}

export interface Manifest {
  rev: number;
  generatedAt: string;
  baseUrls: { releases: string };
  systems: CatalogEntry[];
}

export const OS_META: Record<
  OsId,
  { label: string; tagline: string; accent: string; kernel: string; pkg: string }
> = {
  buildroot: {
    label: "Buildroot",
    tagline: "Featherweight BusyBox Linux. Boots in seconds.",
    accent: "#f5c518",
    kernel: "6.x (custom)",
    pkg: "none / busybox",
  },
  alpine: {
    label: "Alpine Linux x86",
    tagline: "Security-first musl world in ~40 MB.",
    accent: "#0d597f",
    kernel: "lts i686",
    pkg: "apk",
  },
  debian: {
    label: "Debian i386",
    tagline: "The universal OS, minimal base, real apt.",
    accent: "#d70a53",
    kernel: "686-pae",
    pkg: "apt",
  },
  arch: {
    label: "Arch Linux 32",
    tagline: "Rolling release, pacman, KISS to the bone.",
    accent: "#1793d1",
    kernel: "linux i686",
    pkg: "pacman",
  },
};

export const RAM_OPTIONS = [64, 128, 256, 512, 1024];

export const DEFAULT_HW: Record<OsId, HardwareConfig> = {
  buildroot: {
    ramMB: 128,
    vgaMB: 8,
    diskMB: 64,
    bootOrder: 0,
    acpi: false,
    speaker: true,
    disableJit: false,
    nicType: "virtio",
    netBackend: "off",
    gatewayUrl: "",
    corsProxy: "",
    doh: true,
  },
  alpine: {
    ramMB: 256,
    vgaMB: 8,
    diskMB: 256,
    bootOrder: 0,
    acpi: false,
    speaker: false,
    disableJit: false,
    nicType: "virtio",
    netBackend: "off",
    gatewayUrl: "",
    corsProxy: "",
    doh: true,
  },
  debian: {
    ramMB: 256,
    vgaMB: 8,
    diskMB: 512,
    bootOrder: 0,
    acpi: false,
    speaker: false,
    disableJit: false,
    nicType: "ne2k",
    netBackend: "off",
    gatewayUrl: "",
    corsProxy: "",
    doh: true,
  },
  arch: {
    ramMB: 512,
    vgaMB: 8,
    diskMB: 1024,
    bootOrder: 0,
    acpi: false,
    speaker: false,
    disableJit: false,
    nicType: "ne2k",
    netBackend: "off",
    gatewayUrl: "",
    corsProxy: "",
    doh: true,
  },
};
