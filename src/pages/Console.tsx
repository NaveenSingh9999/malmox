import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Power,
  RotateCcw,
  Maximize,
  Camera,
  Disc,
  SquareTerminal,
  Monitor,
  Keyboard,
  Zap,
} from "lucide-react";
import { useApp } from "@/store/app";
import { MalmoxEngine } from "@/core/engine";
import type { BootMode } from "@/core/types";
import { getSystem, putSystem, getIso, listIsos, putIso } from "@/core/db";
import { loadKernel } from "@/core/install";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HardwarePanel } from "@/pages/HardwarePanel";
import { OS_META } from "@/core/types";

export default function ConsolePage() {
  const { id = "" } = useParams();
  const meta = useApp((s) => s.systems.find((x) => x.id === id));
  const [engine, setEngine] = useState<MalmoxEngine | null>(null);
  const [status, setStatus] = useState<"idle" | "booting" | "running" | "stopped" | "error">("idle");
  const [mode, setMode] = useState<BootMode | null>(null);
  const [bootDialog, setBootDialog] = useState(true);
  const [showHw, setShowHw] = useState(false);
  const [isoList, setIsoList] = useState<Awaited<ReturnType<typeof listIsos>>>([]);

  const termHostRef = useRef<HTMLDivElement | null>(null);
  const screenHostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    void listIsos().then(setIsoList);
  }, []);

  const term = useMemo(() => {
    if (termRef.current) return termRef.current;
    const t = new Terminal({
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 13,
      cursorBlink: true,
      allowProposedApi: true,
      theme: {
        background: "#0b0c0f",
        foreground: "#e6e8ee",
        cursor: "#5e6ad2",
        selectionBackground: "rgba(94,106,210,.35)",
        black: "#0b0c0f",
        brightBlack: "#5b6170",
      },
    });
    const fit = new FitAddon();
    t.loadAddon(fit);
    termRef.current = t;
    fitRef.current = fit;
    return t;
  }, []);

  useEffect(() => {
    if (!meta || !mode || engine) return;
    let cancelled = false;
    async function boot() {
      if (!meta) return;
      await putSystem({ ...meta, lastBootMode: mode! });
      const kernel = await loadKernel(meta.id).catch(() => null);
      const eng = new MalmoxEngine(
        { ...meta, lastBootMode: mode! },
        mode!,
        {
          term,
          fit: fitRef.current!,
          screenContainer: screenHostRef.current!,
        },
        {
          onStatus: (s) => setStatus(s),
          onError: () => setStatus("error"),
          onSnapshot: async () => {
            const sys = await getSystem(meta.id);
            if (sys) await putSystem({ ...sys, snapshotAt: Date.now() });
            await useApp.getState().refreshSystems();
          },
        },
        kernel?.bzimage,
        kernel?.initrd,
      );
      if (cancelled) return;
      setEngine(eng);
      await eng.start();
      requestAnimationFrame(() => fitRef.current?.fit());
    }

    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, mode]);

  useEffect(() => {
    const onResize = () => fitRef.current?.fit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(
    () => () => {
      void engine?.powerOff();
    },
    [engine],
  );

  const chooseMode = useCallback((m: BootMode) => {
    setBootDialog(false);
    setMode(m);
  }, []);

  if (!meta) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-dim">
        System not found.
      </div>
    );
  }

  const running = status === "running";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2">
        <span
          className="h-2 w-2 rounded-full transition-colors"
          style={{
            background:
              status === "running"
                ? "#4cb782"
                : status === "error"
                  ? "#eb5757"
                  : status === "booting"
                    ? "#f2c94c"
                    : "#5b6170",
          }}
        />
        <span className="text-[13px] font-medium">{meta.label}</span>
        <Badge tone="dim">{OS_META[meta.os].pkg}</Badge>
        <Badge tone={running ? "ok" : "dim"}>{status}</Badge>

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" title="Hardware settings" onClick={() => setShowHw(!showHw)}>
            <Zap className="h-3.5 w-3.5" />
          </Button>
          <IsoMenu
            isos={isoList}
            onInsert={async (isoId) => {
              const iso = await getIso(isoId);
              if (iso) await engine?.insertIso(iso.buffer);
            }}
            onEject={() => engine?.ejectIso()}
            onUpload={async (file) => {
              const buf = await file.arrayBuffer();
              const isoId = await putIso(file.name, buf);
              setIsoList(await listIsos());
              const iso = await getIso(isoId);
              if (iso) await engine?.insertIso(iso.buffer);
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            title="Screenshot"
            onClick={() => engine?.screenshot()}
          >
            <Camera className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" title="Fullscreen (desktop)" onClick={() => engine?.fullscreen()}>
            <Maximize className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" title="Ctrl+Alt+Del" onClick={() => engine?.ctrlAltDel()}>
            <Keyboard className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" title="Reset VM" onClick={() => engine?.reset()}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={running ? "danger" : "outline"}
            size="sm"
            onClick={() => (running ? void engine?.powerOff() : undefined)}
          >
            <Power className="h-3 w-3" /> {running ? "Shutdown" : "Off"}
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {/* both hosts stay mounted — v86 needs them at construction time */}
        <div
          className={mode === "desktop" ? "hidden" : "absolute inset-0 overflow-hidden p-2"}
        >
          <div
            ref={(el) => {
              if (el && !el.firstChild) {
                term.open(el);
                fitRef.current?.fit();
              }
              termHostRef.current = el;
            }}
            className="h-full w-full"
          />
        </div>
        <div
          ref={(el) => {
            if (el && !el.dataset.ready) {
              el.innerHTML = "";
              const text = document.createElement("div");
              text.style.whiteSpace = "pre";
              text.style.font = "14px monospace";
              text.style.lineHeight = "14px";
              const canvas = document.createElement("canvas");
              canvas.style.display = "none";
              el.append(text, canvas);
              el.dataset.ready = "1";
            }
            screenHostRef.current = el;
          }}
          className={
            mode === "desktop"
              ? "absolute inset-0 flex items-center justify-center bg-black"
              : "hidden"
          }
        />

        {status === "booting" && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border border-line-strong bg-panel px-3 py-1 font-mono text-[11px] text-dim">
            booting {meta.label}…
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-x-0 top-3 mx-auto w-fit rounded-md border border-bad/40 bg-bad/10 px-3 py-1.5 text-xs text-bad">
            Emulator failed to start — try lower RAM or reload.
          </div>
        )}
        {showHw && (
          <div className="absolute right-3 top-3 max-h-[85%] w-80 overflow-y-auto">
            <HardwarePanel metaId={meta.id} onClose={() => setShowHw(false)} live={engine ?? undefined} />
          </div>
        )}
      </div>

      <Dialog open={bootDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Boot {meta.label}</DialogTitle>
            <DialogDescription>
              Pick a console for this session. You can switch by rebooting the machine.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="group rounded-md border border-line-strong p-4 text-left transition-colors hover:border-accent"
              onClick={() => chooseMode("terminal")}
            >
              <SquareTerminal className="mb-2 h-5 w-5 text-accent" />
              <div className="text-[13px] font-semibold">Terminal</div>
              <div className="mt-0.5 text-xs leading-relaxed text-dim">
                Serial console. Fast, precise, ideal for shell work.
              </div>
            </button>
            <button
              className="group rounded-md border border-line-strong p-4 text-left transition-colors hover:border-accent"
              onClick={() => chooseMode("desktop")}
            >
              <Monitor className="mb-2 h-5 w-5 text-accent" />
              <div className="text-[13px] font-semibold">Desktop</div>
              <div className="mt-0.5 text-xs leading-relaxed text-dim">
                VGA display with jwm window manager and mouse.
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IsoMenu({
  isos,
  onInsert,
  onEject,
  onUpload,
}: {
  isos: { id: string; name: string; bytes: number; at: number }[];
  onInsert: (id: string) => Promise<void>;
  onEject: () => void;
  onUpload: (f: File) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="ghost" size="icon" title="CD-ROM" onClick={() => setOpen(!open)}>
        <Disc className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-64 rounded-md border border-line-strong bg-panel p-2 shadow-xl">
            <div className="px-1 pb-1.5 pt-0.5 text-[10px] uppercase tracking-widest text-faint">
              CD-ROM drive
            </div>
            {!isos.length && (
              <div className="px-1 pb-1 text-xs text-faint">No ISOs mounted.</div>
            )}
            {isos.map((i) => (
              <button
                key={i.id}
                className="flex w-full items-center justify-between rounded px-1 py-1 text-left text-xs text-dim hover:bg-panel-2 hover:text-ink"
                onClick={() => {
                  setOpen(false);
                  void onInsert(i.id);
                }}
              >
                <span className="truncate">{i.name}</span>
                <Badge tone="dim">{Math.round(i.bytes / 1048576)}M</Badge>
              </button>
            ))}
            <label className="mt-1 block cursor-pointer rounded border border-dashed border-line-strong px-2 py-1.5 text-center text-[11px] text-faint hover:border-accent hover:text-ink">
              + Insert .iso file
              <input
                type="file"
                accept=".iso"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f);
                  setOpen(false);
                }}
              />
            </label>
            <button
              className="mt-1 w-full rounded px-1 py-1 text-left text-xs text-dim hover:bg-panel-2 hover:text-ink"
              onClick={() => {
                onEject();
                setOpen(false);
              }}
            >
              Eject drive
            </button>
          </div>
        </>
      )}
    </div>
  );
}
