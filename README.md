# MalMox — Linux in a browser tab

**Real Linux. Real kernel. Zero servers doing the work.**

MalMox boots complete 32-bit x86 Linux systems inside a WebAssembly PC emulator, entirely
in your browser tab. Pick a system once, it downloads and is stored locally; from then on
everything — boot, shell, packages, desktop — runs client-side against your own hardware.
Filesystems persist across reloads via IndexedDB snapshots.

```
┌─ React + Vite + shadcn/ui (PWA) ────────────────────────────────────┐
│  Catalog · Library · Console (xterm.js ⇄ VGA canvas) · Settings     │
├─────────────────────────────────────────────────────────────────────┤
│  MalmoxEngine (v86, BSD-2)          StorageLayer                    │
│   ├ serial → xterm.js                ├ disk chunks → IndexedDB      │
│   ├ VGA/VBE → canvas + PS/2 mouse    ├ gzip snapshots → resume      │
│   ├ virtio / NE2000 NIC              └ quota meter + persistence    │
│   └ Wake Lock keep-awake                                            │
├─────────────────────────────────────────────────────────────────────┤
│  Ethernet backends (per-machine, runtime-switchable)                │
│   offline · browser-LAN (cross-tab virtual switch)                  │
│   fetch stack (serverless userspace TCP/IP over fetch())            │
│   gateway (wisp:// endpoint → full TCP/UDP internet, DoH)           │
└─────────────────────────────────────────────────────────────────────┘
```

## The catalog

All systems are **i686** — a hard property of browser CPU emulation (v86 executes
32-bit x86 → WASM). This is not a limitation of your device.

| System | Download | Boots in | Package manager | Desktop |
|---|---|---|---|---|
| Buildroot Classic | ~6 MB | ~8 s | busybox | — |
| Buildroot Plus / Dev | ~8–10 MB | ~10 s | busybox | — |
| Alpine Linux x86 | ~47 MB | ~30 s | apk | Xfbdev + jwm |
| FreeDOS 1.2 | ~1 MB | ~3 s | — | — |
| KolibriOS | ~2 MB | ~2 s | — | built-in GUI |
| Arch Linux 32 | ~796 MB | ~90 s | pacman | Xorg + jwm |
| ReactOS | ~320 MB | ~60 s | — | Win32-style GUI |

**Bring your own:** use *Library → New from file* (or *Catalog → Import*) to boot any
`.iso` / `.img` you legally own — Windows, Android-x86, a custom Linux — entirely in
your browser. The image is stored in IndexedDB; nothing is uploaded.

## Features

- **Terminal mode** — serial console into xterm.js: fast, precise, copy-paste friendly
- **Desktop mode** — VGA/VBE canvas with captured mouse; pick per boot
- **Display controls** — integer/pixelated zoom (slider + `+`/`-` keys), *Fit to window*,
  and true Fullscreen on the VGA pane; VGA memory bumped to 16 MB so guests can select
  up to 1280×1024 via VBE
- **Full hardware control** — RAM slider (snapped to a power of 2), VGA memory, disk resize,
  ACPI, speaker, JIT toggle, NIC type (virtio/NE2000), ethernet backend, CORS proxy, DoH
- **Snapshots** — autosaved (gzip) every 2 min and on tab hide; resume instantly, discard anytime
- **Wake lock** — screen stays awake while a VM runs (auto re-acquire)
- **Import / bring-your-own** — upload any local `.iso` / `.img` / `.raw` (`.gz` auto-extracted)
  as a bootable machine; hot-insert CDs at runtime from the Media menu
- **Browser LAN** — multiple MalMox tabs form one virtual ethernet segment via BroadcastChannel
- **Installable PWA** — offline app shell after first visit

## Honest architecture notes

Browsers cannot emit raw ethernet frames — no WASM construction changes that; it is the
sandbox's egress model. MalMox therefore ships the complete set of legal transports:

1. `browser LAN` — real inter-VM networking, fully serverless
2. `fetch` — userspace TCP/IP stack bridged to HTTP(S): serverless web access
3. `gateway` — point at any `wisp://` endpoint (self-host or community) for full
   TCP/UDP internet with DNS-over-HTTPS

The emulated NIC itself is genuine hardware emulation the guest kernel drives natively.

## Engine roadmap — 64-bit & ARM

MalMox's `EmulatorEngine` contract (`src/core/engine/types.ts`) is satisfied today by
`V86Engine` (32-bit x86 only). To run **x86-64 Debian, modern Windows, or Android (ARM)**
a second backend — QEMU compiled to WebAssembly — is planned. The interface, UI, store and
persistence are already engine-agnostic; the blocking work is the (large) QEMU→WASM build
itself. See [`docs/qemu-wasm.md`](docs/qemu-wasm.md) for the spike result and recipe.

## Development

```bash
bun install
bun dev        # http://localhost:5173
bun test       # vitest unit suite
bun run build  # production build
```

### Image pipeline (GitHub Actions)

`.github/workflows/build-images.yml` builds all four root filesystems in containers on
`workflow_dispatch`, then attaches `.img.gz` artifacts + `SHA256SUMS` + refreshed
`catalog.json` to the `images-v1` GitHub Release. Pipeline sources live in `pipeline/`:

- `pipeline/buildroot/` — buildroot defconfig (i686, ext4 root, ttyS0)
- `pipeline/alpine/` — apk-based chroot build (upstream v86 method) + Xfbdev/jwm
- `pipeline/debian/` — debootstrap --variant=minbase trixie i386 + linux-686-pae
- `pipeline/arch32/` — archlinux32 pacstrap under QEMU binfmt

Deployments go to Vercel via `.github/workflows/deploy-vercel.yml`.

## Licenses

v86 BSD-2 · SeaBIOS LGPLv3 · VGABIOS LGPL · Linux GPLv2 · distro images retain upstream
licenses. Mirrored sources are attributed per image in the catalog.

**Bring-your-own images** (Windows, historical OSes, etc.) are uploaded by you and stored
locally — MalMox never redistributes them. For historical operating-system images, see
[WinWorldPC](https://winworldpc.com/library/operating-systems); you are responsible for
complying with each image's license.

---

Built as a production tool: checksummed installs, persistent storage pinning, quota
visibility, graceful offline behaviour, no analytics, no telemetry, no compute server.
