import { openDB, type IDBPDatabase } from "idb";
import type { SystemMeta } from "./types";
import { CHUNK, ChunkStore } from "./binutil";

const DB_NAME = "malmox";
const DB_VERSION = 1;

let dbp: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        const x = d as unknown as IDBPDatabase;
        if (!x.objectStoreNames.contains("systems")) {
          x.createObjectStore("systems", { keyPath: "id" });
        }
        if (!x.objectStoreNames.contains("chunks")) {
          x.createObjectStore("chunks");
        }
        if (!x.objectStoreNames.contains("snapshots")) {
          x.createObjectStore("snapshots");
        }
        if (!x.objectStoreNames.contains("isos")) {
          x.createObjectStore("isos");
        }
      },
    });
  }
  return dbp;
}

export async function listSystems(): Promise<SystemMeta[]> {
  const d = await db();
  const all = await d.getAll("systems");
  return all as SystemMeta[];
}

export async function getSystem(id: string): Promise<SystemMeta | undefined> {
  const d = await db();
  return (await d.get("systems", id)) as SystemMeta | undefined;
}

export async function putSystem(meta: SystemMeta): Promise<void> {
  const d = await db();
  await d.put("systems", meta);
}

export async function deleteSystemCompletely(
  id: string,
): Promise<void> {
  const d = await db();
  await d.delete("systems", id);
  await deleteDiskChunks(id);
  await d.delete("snapshots", `state:${id}`);
  await d.delete("snapshots", `stategz:${id}`);
}

async function eachChunkKey(
  prefix: string,
  fn: (key: IDBValidKey) => void,
): Promise<void> {
  const d = await db();
  let cursor = await d.transaction("chunks").store.openCursor();
  while (cursor) {
    const key = String(cursor.key);
    if (key.startsWith(prefix)) fn(cursor.key);
    cursor = await cursor.continue();
  }
}

export async function writeDiskChunks(
  id: string,
  buffer: ArrayBuffer,
): Promise<void> {
  const d = await db();
  const store = new ChunkStore(ChunkStore.chunkCount(buffer.byteLength));
  const parts = store.split(buffer);
  for (let i = 0; i < parts.length; i++) {
    await d.put("chunks", parts[i], store.key(`${id}:${i}`));
  }
}

export async function readDiskChunks(
  id: string,
  totalBytes: number,
): Promise<ArrayBuffer | null> {
  const d = await db();
  const count = ChunkStore.chunkCount(totalBytes);
  const first = await d.get("chunks", new ChunkStore(count).key(`${id}:0`));
  if (first === undefined) return null;
  const tx = d.transaction("chunks", "readonly");
  const parts: ArrayBuffer[] = [first];
  for (let i = 1; i < count; i++) {
    const p = await tx.store.get(new ChunkStore(count).key(`${id}:${i}`));
    parts.push(p ?? new ArrayBuffer(CHUNK));
  }
  return new ChunkStore(count).join(parts, totalBytes);
}

export async function deleteDiskChunks(id: string): Promise<number> {
  const d = await db();
  const keys: IDBValidKey[] = [];
  await eachChunkKey(`chunk:${id}:`, (k) => keys.push(k));
  const tx = d.transaction("chunks", "readwrite");
  for (const k of keys) await tx.store.delete(k);
  await tx.done;
  return keys.length;
}

export async function saveSnapshotGz(
  id: string,
  state: ArrayBuffer,
  gz: ArrayBuffer,
): Promise<void> {
  const d = await db();
  await d.put("snapshots", { at: Date.now(), size: state.byteLength }, `state:${id}`);
  await d.put("snapshots", gz, `stategz:${id}`);
}

export async function loadSnapshotGz(
  id: string,
): Promise<{ gz: ArrayBuffer; at: number; size: number } | null> {
  const d = await db();
  const meta = (await d.get("snapshots", `state:${id}`)) as
    | { at: number; size: number }
    | undefined;
  const blob = (await d.get("snapshots", `stategz:${id}`)) as
    | ArrayBuffer
    | undefined;
  if (!meta || !blob) return null;
  return { gz: blob as ArrayBuffer, at: meta.at, size: meta.size };
}

export async function clearSnapshot(id: string): Promise<void> {
  const d = await db();
  await d.delete("snapshots", `state:${id}`);
  await d.delete("snapshots", `stategz:${id}`);
}

export async function putIso(
  name: string,
  buffer: ArrayBuffer,
): Promise<string> {
  const d = await db();
  const id = `iso-${Date.now()}`;
  await d.put("isos", { id, name, buffer, at: Date.now() }, id);
  return id;
}

export async function getIso(id: string) {
  const d = await db();
  return (await d.get("isos", id)) as
    | { id: string; name: string; buffer: ArrayBuffer; at: number }
    | undefined;
}

export async function listIsos() {
  const d = await db();
  const keys = await d.getAllKeys("isos");
  const out = [] as { id: string; name: string; bytes: number; at: number }[];
  for (const k of keys) {
    const v = (await d.get("isos", k)) as
      | { id: string; name: string; buffer: ArrayBuffer; at: number }
      | undefined;
    if (v) out.push({ id: v.id, name: v.name, bytes: v.buffer.byteLength, at: v.at });
  }
  return out;
}

export async function deleteIso(id: string): Promise<void> {
  const d = await db();
  await d.delete("isos", id);
}

export async function putArtifact(key: string, buf: ArrayBuffer): Promise<void> {
  const d = await db();
  await d.put("snapshots", buf, key);
}

export async function getArtifact(key: string): Promise<ArrayBuffer | undefined> {
  const d = await db();
  return (await d.get("snapshots", key)) as ArrayBuffer | undefined;
}

export async function storageUsage(): Promise<{ usage: number; quota: number }> {
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate();
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
  }
  return { usage: 0, quota: 0 };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage?.persist) {
    const already = await navigator.storage.persisted?.();
    if (already) return true;
    return await navigator.storage.persist();
  }
  return false;
}
