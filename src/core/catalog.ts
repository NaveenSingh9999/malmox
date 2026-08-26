import type { Manifest } from "./types";

export const FALLBACK_MANIFEST_URL = "/catalog.json";

// Same-origin by default: /cdn/* is proxied by Vercel to the malmox-images
// GitHub Release — zero CORS, zero third-party exposure in the browser.
let manifestCache: Manifest | null = null;

export async function loadManifest(): Promise<Manifest> {
  if (manifestCache) return manifestCache;
  const res = await fetch(FALLBACK_MANIFEST_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
  manifestCache = (await res.json()) as Manifest;
  return manifestCache;
}

export function resolveUrl(base: string, path: string): string {
  const b = (base || "/cdn").replace(/\/$/, "");
  return `${b}/${path}`;
}
