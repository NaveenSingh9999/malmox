import type { Manifest } from "./types";

export const FALLBACK_MANIFEST_URL = "/catalog.json";

let manifestCache: Manifest | null = null;

export async function loadManifest(): Promise<Manifest> {
  if (manifestCache) return manifestCache;
  const res = await fetch(FALLBACK_MANIFEST_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
  manifestCache = (await res.json()) as Manifest;
  return manifestCache;
}

export function resolveUrl(manifest: Manifest, path: string): string {
  if (/^https?:/.test(path)) return path;
  const base = manifest.baseUrls.releases.replace(/\/$/, "");
  return `${base}/${path}`;
}

export async function verifyRemoteSha256(
  url: string,
  expected: string,
): Promise<boolean> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return false;
    const text = (await res.text()).trim();
    return text.split(/\s+/)[0].toLowerCase() === expected.toLowerCase();
  } catch {
    return false;
  }
}
