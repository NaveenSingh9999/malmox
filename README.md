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
| Buildroot Tiny | ~11 MB | ~10 s | busybox | — |
| Alpine Linux x86 | ~42 MB | ~30 s | apk | Xfbdev + jwm |
| Debian i386 minbase | ~78 MB | ~60 s | apt | Xorg + jwm |
| Arch Linux 32 | ~120 MB | ~90 s | pacman | Xorg + jwm |

## Features

- **Terminal mode** — serial console into xterm.js: fast, precise, copy-paste friendly
- **Desktop mode** — VGA/VBE canvas with jwm window manager and captured mouse; pick per boot
- **Full hardware control** — RAM slider, VGA memory, disk resize, ACPI, speaker,
  JIT toggle, NIC type (virtio/NE2000), ethernet backend, CORS proxy, DoH
- **Snapshots** — autosaved (gzip) every 2 min and on tab hide; resume instantly, discard anytime
- **Wake lock** — screen stays awake while a VM runs (auto re-acquire)
- **Import** — bring any local i686 raw image or .iso; hot-insert CDs at runtime
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

v86 BSD-2-Clause · SeaBIOS LGPLv3 · VGABIOS LGPLv2/Linux-contrib · Linux kernel GPLv2
(distro images retain upstream licenses; source links in-app under Settings → About).

---

Built as a production tool: checksummed installs, persistent storage pinning, quota
visibility, graceful offline behaviour, no analytics, no telemetry, no compute server.
