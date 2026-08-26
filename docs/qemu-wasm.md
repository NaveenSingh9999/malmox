# QEMU-WASM backend — x86-64 / ARM track

MalMox today runs **only 32-bit x86** guests because its engine (`V86Engine`)
emulates a single 32-bit core. To support what users actually asked for —
**64-bit Debian, modern Windows, Android (ARM)** — MalMox needs a second
engine: **QEMU compiled to WebAssembly** (system emulation, TCG).

This document is the result of the "attempt a real QEMU build" spike.

## Spike result (2026-08-26)

The build was **not possible in the dev sandbox**:

- No `emcc` / `emsdk` (Emscripten SDK) present.
- No `docker` present.
- `wasm-ld` exists but is not enough — Emscripten + a full QEMU cross-compile
  is a multi-GB, multi-hour build.

QEMU-to-WASM also has a hard performance caveat: in WASM the TCG JIT cannot
emit native code, so it runs in **interpreter mode** → roughly 10–50× slower
than native. A 64-bit Debian desktop would be sluggish but usable for
server/serial workloads. This is inherent to running a full system emulator
in the browser and is not fixable by optimization alone.

## Architecture (how it plugs in)

`EmulatorEngine` (`src/core/engine/types.ts`) is the contract every backend
implements. `V86Engine` is one implementation. A `QemuEngine` is a second
implementation that:

1. Loads `qemu-system-x86_64.wasm` + a BIOS (`bios-256k.bin`) + VGA BIOS.
2. Receives the guest disk as a chunked IndexedDB-backed block device
   (reuse `db.writeAsset` / `readAsset`) exposed to QEMU as a virtio-blk
   or IDE device via a JS filesystem shim.
3. Renders VGA to a canvas (same `screenContainer` the Console already owns)
   and bridges serial/keyboard/mouse through the existing `EngineHandles`.
4. Restores/saves state to IndexedDB (QEMU `migrate` to a file → chunk store).

The UI, store, and persistence layers already speak `EmulatorEngine`, so once
`QemuEngine` exists they require no changes to support 64-bit guests.

## Build recipe (run in a proper CI / Linux box with Emscripten)

```bash
# 1. Install Emscripten (needs ~5GB and network)
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk && ./emsdk install latest && ./emsdk activate latest && source ./emsdk_env.sh

# 2. Build QEMU system emulator for x86_64 with WASM
git clone --depth 1 https://gitlab.com/qemu-project/qemu.git
cd qemu
mkdir build && cd build
emconfigure ../configure \
  --target-list=x86_64-softmmu \
  --disable-capstone --disable-docs --disable-gtk --disable-sdl \
  --disable-opengl --disable-vnc --enable-fdt \
  --prefix=$PWD/install
emmake make -j$(nproc)
# produces build/qemu-system-x86_64 (native). For WASM you instead build with
# the wasm backend; this is the heavy, unresolved part and needs a working
# emscripten QEMU port (see https://github.com/qemu/qemu blob/master/docs/devel/emscripten.rst)

# 3. Ship qemu-system-x86_64.wasm + bios to /emulator/ and load via QemuEngine
```

> The Emscripten QEMU port is experimental and frequently broken across
> versions. Budget this as a multi-session infrastructure project, not a
> one-round tweak. Recommendation: start from a known-good fork (search
> "qemu wasm" / "v86 alternative") rather than upstream.

## Status
- [x] `EmulatorEngine` interface defined and `V86Engine` conforms.
- [x] Console/store/persistence are engine-agnostic.
- [ ] `QemuEngine` implementation (blocked on the WASM build above).
- [ ] IndexedDB block-device shim for QEMU.
- [ ] ARM (Android) target (`aarch64-softmmu`).
