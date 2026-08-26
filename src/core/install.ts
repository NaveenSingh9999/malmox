import type { CatalogEntry, HardwareConfig, SystemMeta, AssetRole } from "./types";
import { DEFAULT_HW } from "./types";
import { gunzip, sha256Hex } from "./binutil";
import {
  clearSnapshot,
  deleteSystemAssets,
  getSystem,
  putArtifact,
  putIso,
  putSystem,
  readAsset,
  writeAsset,
} from "./db";
import { resolveUrl } from "./catalog";

export interface InstallProgress {
  phase: "download" | "verify" | "decompress" | "write" | "done";
  loaded: number;
  total: number;
}

async function fetchBuffer(
  url: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length") ?? 0);
  if (!res.body || !total) return await res.arrayBuffer();
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value!);
    loaded += value!.byteLength;
    onProgress?.(loaded, total);
  }
  const out = new Uint8Array(loaded);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out.buffer;
}

export async function installEntry(
  entry: CatalogEntry,
  base: string,
  onProgress: (p: InstallProgress) => void,
): Promise<SystemMeta> {
  const existing = await getSystem(entry.id);
  if (existing) return existing;

  const perFile = 1 / Math.max(1, entry.assets.length);
  let done = 0;
  const sizes: Partial<Record<AssetRole, number>> = {};
  let totalBytes = 0;

  for (const asset of entry.assets) {
    onProgress({
      phase: "download",
      loaded: done,
      total: entry.sizeMB * 1024 * 1024,
    });
    const buf = await fetchBuffer(resolveUrl(base, asset.file), (l, t) => {
      onProgress({
        phase: "download",
        loaded: done + l * perFile,
        total: entry.sizeMB * 1024 * 1024,
      });
    });
    done += perFile;

    const hash = await sha256Hex(buf);

    // gzip-compressed assets are decompressed transparently
    const isGz =
      asset.file.endsWith(".gz") ||
      (buf.byteLength > 2 && new Uint8Array(buf, 0, 2)[0] === 0x1f &&
        new Uint8Array(buf, 0, 2)[1] === 0x8b);
    const raw = isGz ? await gunzip(buf) : buf;

    if (asset.role === "bzimage" || asset.role === "initrd") {
      await putArtifact(asset.role === "bzimage" ? `bz:${entry.id}` : `rd:${entry.id}`, raw);
      sizes[asset.role] = raw.byteLength;
    } else {
      await writeAsset(entry.id, asset.role, raw);
      sizes[asset.role] = raw.byteLength;
    }
    totalBytes += raw.byteLength;
    void hash;
  }

  const total = totalBytes;
  const meta: SystemMeta = {
    id: entry.id,
    label: entry.label,
    family: entry.family,
    version: entry.version,
    installedAt: Date.now(),
    sizeBytes: total,
    assets: sizes,
    hardware: hwFor(entry),
    display: entry.display,
  };
  await putSystem(meta);
  onProgress({ phase: "done", loaded: 1, total: 1 });
  return meta;
}



export async function loadBootAssets(
  id: string,
  roles: AssetRole[],
  sizes: Partial<Record<AssetRole, number>>,
): Promise<Partial<Record<AssetRole, ArrayBuffer>>> {
  const { getArtifact } = await import("./db");
  const out: Partial<Record<AssetRole, ArrayBuffer>> = {};
  for (const role of roles) {
    if (role === "bzimage") {
      out.bzimage = await getArtifact(`bz:${id}`);
      continue;
    }
    if (role === "initrd") {
      out.initrd = await getArtifact(`rd:${id}`);
      continue;
    }
    const size = sizes[role];
    if (size && Number.isFinite(size)) {
      out[role] = (await readAsset(id, role, size)) ?? undefined;
    }
  }
  return out;
}

export async function materializeDisk(id: string, sizeBytes: number): Promise<ArrayBuffer | null> {
  return await readAsset(id, "hda", sizeBytes);
}

export async function importLocalImage(
  file: File,
  label: string,
  hw?: Partial<HardwareConfig>,
): Promise<{ kind: "system"; meta: SystemMeta } | { kind: "iso"; id: string }> {
  const buf = await file.arrayBuffer();
  const isGz = /\.gz$/i.test(file.name);
  const raw = isGz ? await gunzip(buf) : buf;

  if (/\.iso$/i.test(file.name)) {
    return { kind: "iso", id: await putIso(file.name, raw) };
  }

  const id = `import-${Date.now()}`;
  await writeAsset(id, "hda", raw);
  const meta: SystemMeta = {
    id,
    label: label || file.name.replace(/\.(img|raw)?(\.gz)?$/i, ""),
    family: "glibc",
    version: "local",
    installedAt: Date.now(),
    sizeBytes: raw.byteLength,
    hardware: { ...DEFAULT_HW, ...hw },
    display: "canvas",
  };
  await putSystem(meta);
  return { kind: "system", meta };
}

export async function uninstall(id: string): Promise<void> {
  await clearSnapshot(id);
  await deleteSystemAssets(id);
  const { deleteSystemCompletely } = await import("./db");
  await deleteSystemCompletely(id);
}

function hwFor(entry: CatalogEntry): HardwareConfig {
  return {
    ...DEFAULT_HW,
    ramMB: entry.boot === "kernel" ? 128 : DEFAULT_HW.ramMB,
  };
}
