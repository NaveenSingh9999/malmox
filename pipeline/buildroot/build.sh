#!/usr/bin/env bash
# Builds a tiny i686 Linux (buildroot) with ext4 root on hda, serial console.
# Output: $1 = raw image path. Requires docker.
set -euo pipefail
OUT="${1:?usage: build.sh <out.img>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"

docker run --rm -v "$HERE:/cfg:ro" -v "$WORK:/work" buildroot/buildroot:2024.02 << 'EOS'
set -e
cd /work
make BR2_EXTERNAL=/cfg defconfig BR2_DEFCONFIG=/cfg/malmox_defconfig
make -j"$(nproc)"
EOS

IMG="$OUT"
truncate -s 64M "$IMG"
mkfs.ext4 -F -d "$WORK/target" -L root "$IMG"
echo "[malmox] wrote $IMG"
