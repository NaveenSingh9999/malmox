import type { CatalogEntry, HardwareConfig, SystemMeta } from "./types";
import { DEFAULT_HW } from "./types";
import { gunzip, sha256Hex } from "./binutil";
import {
  clearSnapshot,
  deleteDiskChunks,
  getSystem,
  putArtifact,
  putIso,
  putSystem,
  readDiskChunks,
  writeDiskChunks,
} from "./db";
import { resolveUrl } from "./catalog";

export interface InstallProgress {
  phase: "download" | "verify" | "decompress" | "write" | "done";
  loaded: number;
  total: number;
}

export async function installFromCatalog(
  entry: CatalogEntry,
  manifestReleasesBase: string,
  onProgress: (p: InstallProgress) => void,
): Promise<SystemMeta> {
  const id = `${entry.os}-${entry.version}`;
  const existing = await getSystem(id);
  if (existing) return existing;

  const url = resolveUrl({ baseUrls: { releases: manifestReleasesBase } } as never, entry.url);
  onProgress({ phase: "download", loaded: 0, total: entry.downloadMB * 1024 * 1024 });
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const total = Number(res.headers.get("content-length") ?? 0) || entry.downloadMB * 1024 * 1024;
  const reader = res.body!.getReader();
  const parts: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    loaded += value.byteLength;
    onProgress({ phase: "download", loaded, total });
  }
  const compressed = concat(parts, loaded);

  onProgress({ phase: "verify", loaded, total });
  const hash = await sha256Hex(compressed);
  const expected = await fetchExpectedSha(manifestReleasesBase, entry.sha256Url);
  if (expected && expected !== hash) {
    throw new Error(`checksum mismatch: got ${hash.slice(0, 12)}…`);
  }

  onProgress({ phase: "decompress", loaded, total });
  const raw = await gunzip(compressed);

  onProgress({ phase: "write", loaded, total });
  await writeDiskChunks(id, raw);

  for (const [key, path] of [
    [`bz:${id}`, entry.bzimage],
    [`rd:${id}`, entry.initrd],
  ] as const) {
    if (!path) continue;
    const res = await fetch(resolveUrl({ baseUrls: { releases: manifestReleasesBase } } as never, path));
    if (res.ok) {
      await putArtifact(key, await res.arrayBuffer());
    }
  }

  const meta: SystemMeta = {
    id,
    os: entry.os,
    label: entry.label,
    version: entry.version,
    installedAt: Date.now(),
    sha256: hash,
    sizeBytes: raw.byteLength,
    hardware: hardwareFor(entry),
  };
  await putSystem(meta);
  onProgress({ phase: "done", loaded, total });
  return meta;
}

export async function importLocalImage(
  file: File,
  os: SystemMeta["os"],
  label: string,
  diskMB: number,
  hw?: Partial<HardwareConfig>,
  asIso = false,
): Promise<SystemMeta | string> {
  const buf = await file.arrayBuffer();
  const raw = /\.gz$/.test(file.name) ? await gunzip(buf) : buf;

  if (asIso || /\.iso$/i.test(file.name)) {
    return await putIso(file.name, raw);
  }

  const id = `import-${os}-${Date.now()}`;
  await writeDiskChunks(id, raw);
  const meta: SystemMeta = {
    id,
    os,
    label: label || file.name.replace(/\.(img|raw)?(\.gz)?$/i, ""),
    version: "local",
    installedAt: Date.now(),
    sha256: await sha256Hex(raw),
    sizeBytes: raw.byteLength,
    hardware: { ...DEFAULT_HW[os], diskMB, ...hw },
  };
  await putSystem(meta);
  return meta;
}

export async function materializeDisk(id: string, sizeBytes: number): Promise<ArrayBuffer> {
  const stored = await readDiskChunks(id, sizeBytes);
  if (stored) return stored;
  return new ArrayBuffer(sizeBytes);
}

export async function loadKernel(
  id: string,
): Promise<{ bzimage: ArrayBuffer; initrd: ArrayBuffer } | null> {
  const { getArtifact } = await import("./db");
  const [bz, rd] = await Promise.all([
    getArtifact(`bz:${id}`),
    getArtifact(`rd:${id}`),
  ]);
  return bz && rd ? { bzimage: bz, initrd: rd } : null;
}

export async function uninstall(id: string): Promise<void> {
  await clearSnapshot(id);
  await deleteDiskChunks(id);
  const d = await getSystem(id);
  if (!d) return;
  const { deleteSystemCompletely } = await import("./db");
  await deleteSystemCompletely(id);
}

async function fetchExpectedSha(base: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(resolveUrl({ baseUrls: { releases: base } } as never, path), {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.text()).trim().split(/\s+/)[0].toLowerCase();
  } catch {
    return null;
  }
}

function concat(parts: Uint8Array[], length: number): ArrayBuffer {
  const out = new Uint8Array(length);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out.buffer;
}

function hardwareFor(entry: CatalogEntry): HardwareConfig {
  return { ...DEFAULT_HW[entry.os], diskMB: Math.round(entry.diskMB / (1024 * 1024)) };
}
