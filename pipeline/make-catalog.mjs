#!/usr/bin/env node
// Regenerates public/catalog.json sizes from actual artifacts.
// Usage: make-catalog.mjs --dir <dir> --out <file> --releases <baseUrl>
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};

const dir = arg("dir", ".");
const out = arg("out", "catalog.json");
const releases = arg(
  "releases",
  "https://github.com/malmox/images/releases/download/images-v1",
);

const files = new Set(readdirSync(dir));
const sizeOf = (n) => {
  for (const f of files) if (f.startsWith(n) && f.endsWith(".img.gz")) {
    return Math.round(statSync(join(dir, f)).size / 1048576);
  }
  return null;
};

let catalog;
try {
  catalog = JSON.parse(readFileSync(out, "utf8"));
} catch {
  catalog = JSON.parse(readFileSync("public/catalog.json", "utf8"));
}
catalog.baseUrls.releases = releases;
catalog.generatedAt = new Date().toISOString();
catalog.rev = (catalog.rev ?? 0) + 1;

for (const s of catalog.systems) {
  const dl = sizeOf(s.os === "arch" ? "arch32" : s.os);
  if (dl) s.downloadMB = dl;
}

writeFileSync(out, JSON.stringify(catalog, null, 2));
console.log(`[malmox] ${out} rev ${catalog.rev}`);
