import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Power,
  RotateCcw,
  Maximize,
  Disc,
  Columns2,
  SquareTerminal,
  Monitor,
  Keyboard,
  Camera,
  Save,
  Loader2,
  Zap,
} from "lucide-react";
import { useApp } from "@/store/app";
import { MalmoxEngine } from "@/core/engine";
import type { BootMode } from "@/core/types";
import { getSystem, putSystem, getIso, listIsos, putIso } from "@/core/db";
import { loadBootAssets } from "@/core/install";
import { loadManifest } from "@/core/catalog";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Button } from "@/components/ui/button";
import {
  Menu,
  StatusPill,
  toast,
} from "@/components/chrome";
import { cn } from "@/lib/utils";
import { HardwarePanel } from "@/pages/HardwarePanel";

type Pane = "serial" | "display" | "split";

export default function ConsolePage() {
  const { id = "" } = useParams();
  const meta = useApp((s) => s.systems.find((x) => x.id === id));
  const [engine, setEngine] = useState<MalmoxEngine | null>(null);
  const [status, setStatus] = useState<"idle" | "booting" | "running" | "stopped" | "error">("idle");
  const [pane, setPane] = useState<Pane>("split");
  const [fontSize, setFontSize] = useState(13);
  const [snapAge, setSnapAge] = useState<number>(meta?.snapshotAt ?? 0);
  const [showHw, setShowHw] = useState(false);
  const [isos, setIsos] = useState<Awaited<ReturnType<typeof listIsos>>>([]);

  const termElRef = useRef<HTMLDivElement | null>(null);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const bootedRef = useRef(false);

  const term = useMemo(() => {
    if (termRef.current) return termRef.current;
    const t = new Terminal({
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 13,
      cursorBlink: true,
      scrollback: 5000,
      theme: {
        background: "#0b0c0f",
        foreground: "#e6e8ee",
        cursor: "#5e6ad2",
        selectionBackground: "rgba(94,106,210,.35)",
      },
    });
    const fit = new FitAddon();
    t.loadAddon(fit);
    termRef.current = t;
    fitRef.current = fit;
    return t;
  }, []);

  // boot once per machine id
  useEffect(() => {
    if (!meta || bootedRef.current) return;
    bootedRef.current = true;
    let dead = false;

    (async () => {
      const entry = await loadManifest()
        .then((m) => m.systems.find((e) => e.id === id))
        .catch(() => undefined);
      const defaultPane: Pane =
        meta.display === "canvas" ? "display" : "serial";
      setPane(defaultPane);

      const roles = (entry?.assets ?? [{ role: "hda" as const }]).map((a) => a.role);
      const assets = await loadBootAssets(id, roles as never, meta.assets ?? {});
      if (dead) return;

      const eng = new MalmoxEngine(
        meta,
        "terminal",
        assets,
        { term, fit: fitRef.current!, screenContainer: screenRef.current! },
        {
          onStatus: setStatus,
          onError: (m) => toast("error", m.slice(0, 160)),
          onSnapshot: async (at) => {
            setSnapAge(at);
            const sys = await getSystem(meta.id);
            if (sys) await putSystem({ ...sys, snapshotAt: at });
            await useApp.getState().refreshSystems();
          },
        },
      );
      setEngine(eng);
      requestAnimationFrame(() => fitRef.current?.fit());
      await eng.start();
    })();

    return () => {
      dead = true;
      void engine?.powerOff();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    void listIsos().then(setIsos);
    const onResize = () => fitRef.current?.fit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    term.options.fontSize = fontSize;
    fitRef.current?.fit();
  }, [fontSize, term, pane]);

  const pasteSerial = useCallback(
    (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text");
      if (text && engine?.isRunning()) engine.sendText(text);
    },
    [engine],
  );
  useEffect(() => {
    window.addEventListener("paste", pasteSerial);
    return () => window.removeEventListener("paste", pasteSerial);
  }, [pasteSerial]);

  useEffect(
    () => () => {
      void engine?.powerOff();
    },
    [engine],
  );

  if (!meta) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-dim">
        Machine not found.
      </div>
    );
  }

  const running = status === "running";
  const showSerial = pane === "serial" || pane === "split";
  const showDisplay = pane === "display" || pane === "split";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* toolbar */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line bg-panel/60 px-3">
        <span
          className="h-2 w-2 rounded-full"
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
        <StatusPill tone={running ? "ok" : status === "booting" ? "warn" : "dim"}>
          {status}
        </StatusPill>

        <div className="mx-1 h-4 w-px bg-line-strong" />

        {/* pane switch */}
        <div className="flex overflow-hidden rounded-md border border-line-strong">
          {([
            ["serial", SquareTerminal],
            ["display", Monitor],
            ["split", Columns2],
          ] as const).map(([p, Icon]) => (
            <button
              key={p}
              title={p}
              onClick={() => setPane(p)}
              className={cn(
                "flex h-7 w-8 items-center justify-center transition-colors",
                pane === p ? "bg-accent/20 text-accent" : "text-faint hover:text-ink",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            title="Machine settings"
            onClick={() => setShowHw(!showHw)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-dim transition-colors hover:bg-panel-2 hover:text-ink"
          >
            <Zap className="h-3.5 w-3.5" />
          </button>
          {/* media */}
          <Menu
            trigger={<IconBtn title="Media"><Disc className="h-3.5 w-3.5" /></IconBtn>}
            items={[
              ...isos.map((i) => ({
                label: `Insert ${i.name}`,
                onSelect: async () => {
                  const iso = await getIso(i.id);
                  if (iso) {
                    await engine?.insertIso(iso.buffer);
                    toast("ok", `${i.name} inserted`);
                  }
                },
              })),
              {
                label: "Upload .iso…",
                onSelect: () => document.getElementById("malmox-iso-input")?.click(),
              },
              { label: "Eject CD-ROM", onSelect: () => engine?.ejectIso() },
            ]}
          />
          <input
            id="malmox-iso-input"
            type="file"
            accept=".iso"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              toast("info", "Attaching ISO…");
              const buf = await f.arrayBuffer();
              const isoId = await putIso(f.name, buf);
              const iso = await getIso(isoId);
              if (iso) {
                await engine?.insertIso(iso.buffer);
                setIsos(await listIsos());
                toast("ok", `${f.name} attached`);
              }
            }}
          />

          {/* snapshot */}
          <Button
            variant="outline"
            size="sm"
            disabled={!running}
            title="Snapshot now — autosaves every 2 min and on tab hide"
            onClick={() =>
              void engine?.snapshot(false).then(() => toast("ok", "Snapshot saved"))
            }
          >
            <Save className="h-3 w-3" />
            {snapAge ? `saved ${ageStr(snapAge)}` : "snapshot"}
          </Button>

          {/* view */}
          <Menu
            trigger={<IconBtn title="View"><Camera className="h-3.5 w-3.5" /></IconBtn>}
            items={[
              { label: "Fullscreen (display)", onSelect: () => engine?.fullscreen() },
              { label: "Screenshot → download", onSelect: downloadShot(engine) },
              { label: "Font −", onSelect: () => setFontSize((f) => Math.max(9, f - 1)) },
              { label: "Font +", onSelect: () => setFontSize((f) => Math.min(24, f + 1)) },
              { label: "Keyboard shortcuts", onSelect: () => toast("info", "Ctrl+Shift+V paste · Ctrl+Alt+Del in Power menu") },
            ]}
          />

          {/* power */}
          <Menu
            trigger={
              <Button variant={running ? "danger" : "outline"} size="sm" disabled={status !== "running"}>
                <Power className="h-3 w-3" /> Power
              </Button>
            }
            items={[
              { label: "Shut down (ACPI-less stop)", danger: true, onSelect: () => void engine?.powerOff() },
              { label: "Hard reset", onSelect: () => engine?.reset() },
              { label: "Ctrl+Alt+Del", onSelect: () => engine?.ctrlAltDel() },
            ]}
          />
        </div>
      </div>

      {/* panes */}
      <div className="relative flex min-h-0 flex-1">
        {showSerial && (
          <div
            ref={(el) => {
              if (el && !el.firstChild) {
                term.open(el);
                fitRef.current?.fit();
              }
              termElRef.current = el;
            }}
            className={cn("min-w-0 overflow-hidden p-1.5", pane === "split" && "w-1/2 border-r border-line")}
          />
        )}
        <div
          ref={(el) => {
            if (el && !el.dataset.ready) {
              el.innerHTML = "";
              const text = document.createElement("div");
              text.style.cssText = "white-space:pre;font:14px monospace;line-height:14px";
              const canvas = document.createElement("canvas");
              canvas.style.display = "none";
              el.append(text, canvas);
              el.dataset.ready = "1";
            }
            screenRef.current = el;
          }}
          className={cn(
            "min-w-0 flex-1 bg-black",
            showDisplay ? "block" : "hidden",
            showDisplay && "relative flex justify-center [&>div]:max-h-full [&>div]:overflow-hidden",
          )}
          onMouseDown={() => running && pane !== "serial" && engine?.lockMouse()}
        />
        {!showDisplay && <div hidden ref={screenRef} />}

        {showHw && (
          <div className="absolute right-3 top-12 z-40 max-h-[85%] w-80">
            <HardwarePanel metaId={meta.id} onClose={() => setShowHw(false)} />
          </div>
        )}
      </div>

      {/* statusbar */}
      <div className="flex h-6 shrink-0 items-center gap-3 border-t border-line bg-panel/40 px-3 font-mono text-[10px] text-faint">
        <span>{status === "booting" ? <>booting <Loader2 className="inline h-2.5 w-2.5 animate-spin" /></> : status}</span>
        <span>ram {meta.hardware.ramMB}M</span>
        <span>nic {meta.hardware.nicType}/{meta.hardware.netBackend}</span>
        <span className="ml-auto hidden sm:inline">autosnapshot 120s · paste goes to serial</span>
        <Keyboard className="h-3 w-3" />
      </div>
    </div>
  );
}

function downloadShot(engine: MalmoxEngine | null) {
  return () => {
    const img = engine?.screenshot();
    if (!img) return toast("error", "Screenshot needs the Display pane");
    const url = (img as HTMLImageElement).src;
    const a = document.createElement("a");
    a.href = url;
    a.download = `malmox-${Date.now()}.png`;
    a.click();
  };
}

function IconBtn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <span
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-md text-dim transition-colors hover:bg-panel-2 hover:text-ink"
    >
      {children}
    </span>
  );
}

function ageStr(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}
