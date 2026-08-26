#!/usr/bin/env bash
# Assemble SHA256SUMS + catalog.json from build artifacts and upload-ready dist/.
# Usage: release.sh <artifacts-dir> <dist-out>
set -euo pipefail
ART="${1:?usage: release.sh <artifacts-dir> <dist-out>}"
DIST="${2:-dist}"
mkdir -p "$DIST"

# flatten artifacts (actions/download-artifact creates one dir per job)
find "$ART" -name '*.img.gz' -exec cp {} "$DIST/" \;

cd "$DIST"
sha256sum ./*.img.gz > SHA256SUMS

# kernel artifacts ride along if produced by jobs
for k in ../artifacts/*/dist-kernel/*; do
  [ -f "$k" ] && mkdir -p kernels && cp "$k" kernels/
done 2>/dev/null || true

node "$(dirname "$0")/make-catalog.mjs" \
  --dir . --out catalog.json \
  --releases "https://github.com/${GITHUB_REPOSITORY:-malmox/images}/releases/download/images-v1"

echo "[malmox] release payload:"
ls -la
