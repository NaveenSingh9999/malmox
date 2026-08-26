const CHUNK = 8 * 1024 * 1024;

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function gunzip(data: ArrayBuffer): Promise<ArrayBuffer> {
  if (!isGzip(new Uint8Array(data, 0, Math.min(2, data.byteLength)))) {
    return data;
  }
  const ds = new DecompressionStream("gzip");
  const stream = new Blob([data]).stream().pipeThrough(ds);
  return await new Response(stream).arrayBuffer();
}

export async function gzip(data: ArrayBuffer): Promise<ArrayBuffer> {
  const gs = new CompressionStream("gzip");
  const stream = new Blob([data]).stream().pipeThrough(gs);
  return await new Response(stream).arrayBuffer();
}

function isGzip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x1f && bytes[1] === 0x8b;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n;
  let i = -1;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < units.length - 1);
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

export class ChunkStore {
  private cache = new Map<number, ArrayBuffer>();

  constructor(private chunks: number) {}

  static chunkCount(bytes: number): number {
    return Math.ceil(bytes / CHUNK);
  }

  static chunkSize(index: number, totalBytes: number): number {
    const start = index * CHUNK;
    return Math.min(CHUNK, totalBytes - start);
  }

  key(id: string): string {
    return `chunk:${id}`;
  }

  split(buffer: ArrayBuffer): ArrayBuffer[] {
    const out: ArrayBuffer[] = [];
    for (let i = 0; i < this.chunks; i++) {
      out.push(buffer.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    return out;
  }

  join(parts: ArrayBuffer[], totalBytes: number): ArrayBuffer {
    const out = new Uint8Array(totalBytes);
    let off = 0;
    for (const p of parts) {
      out.set(new Uint8Array(p), off);
      off += p.byteLength;
    }
    return out.buffer;
  }
}

export { CHUNK };
