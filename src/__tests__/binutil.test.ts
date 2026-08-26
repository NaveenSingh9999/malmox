import { describe, it, expect } from "vitest";
import { gunzip, gzip, sha256Hex, formatBytes, ChunkStore, CHUNK } from "@/core/binutil";

describe("gzip roundtrip", () => {
  it("compresses and decompresses", async () => {
    const data = new TextEncoder().encode("malmox".repeat(1000)).buffer as ArrayBuffer;
    const gz = await gzip(data);
    expect(gz.byteLength).toBeLessThan(data.byteLength);
    const back = await gunzip(gz);
    expect(new Uint8Array(back)).toEqual(new Uint8Array(data));
  });

  it("passes through non-gzip data untouched", async () => {
    const data = new TextEncoder().encode("plain").buffer as ArrayBuffer;
    expect(await gunzip(data)).toBe(data);
  });
});

describe("sha256Hex", () => {
  it("hashes empty buffer to known digest", async () => {
    expect(await sha256Hex(new ArrayBuffer(0))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("formatBytes", () => {
  it("formats units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024 * 1024 * 1.5)).toBe("1.5 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3 GB");
  });
});

describe("ChunkStore", () => {
  it("splits and joins losslessly across chunk boundaries", () => {
    const total = CHUNK * 2 + 12345;
    const src = new Uint8Array(total);
    crypto.getRandomValues(src);
    const store = new ChunkStore(ChunkStore.chunkCount(total));
    const parts = store.split(src.buffer as ArrayBuffer);
    expect(parts.length).toBe(3);
    const joined = store.join(parts, total);
    expect(new Uint8Array(joined)).toEqual(src);
  });

  it("chunkSize trims final chunk", () => {
    expect(ChunkStore.chunkSize(0, CHUNK + 10)).toBe(CHUNK);
    expect(ChunkStore.chunkSize(1, CHUNK + 10)).toBe(10);
  });
});
