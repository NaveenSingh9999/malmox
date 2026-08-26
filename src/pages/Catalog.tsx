import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, HardDriveDownload, Play, Loader2, Boxes } from "lucide-react";
import { useApp } from "@/store/app";
import { FAMILY_LABEL } from "@/core/types";
import type { BootMode, CatalogEntry } from "@/core/types";
import { installEntry, importLocalImage } from "@/core/install";
import {
  PageHeader,
  StatusPill,
  EmptyState,
  toast,
} from "@/components/chrome";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

const CATEGORY_LABEL: Record<string, string> = {
  tiny: "Instant — boots in seconds",
  linux: "Full Linux",
  retro: "Retro & experimental",
};
const ORDER = ["tiny", "linux", "retro"] as const;

export default function CatalogPage() {
  const { manifest, systems } = useApp();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [pickEntry, setPickEntry] = useState<CatalogEntry | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  async function install(entry: CatalogEntry) {
    setBusyId(entry.id);
    setPhase("connecting");
    try {
      await installEntry(entry, "/cdn", (p) => {
        setPhase(p.phase);
        setProgress(p.total > 0 ? Math.min(100, (p.loaded / p.total) * 100) : 0);
      });
      await useApp.getState().refreshSystems();
      await useApp.getState().refreshStorage();
      toast("ok", `${entry.label} installed`);
      navigate(`/console/${entry.id}`);
    } catch (e) {
      toast("error", `Install failed — ${String(e).slice(0, 120)}`);
    } finally {
      setBusyId(null);
    }
  }

  function launch(entry: CatalogEntry) {
    if (!systems.find((s) => s.id === entry.id)) {
      void install(entry);
      return;
    }
    if (entry.gui || entry.display === "canvas") {
      setPickEntry(entry);
    } else {
      navigate(`/console/${entry.id}`);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader
        title="Images"
        description="Pick a system image. It downloads once with checksum verification and lives in your browser storage — after that everything runs locally."
        actions={
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <HardDriveDownload className="h-3.5 w-3.5" /> Import
          </Button>
        }
      />

      {!manifest && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-panel" />
          ))}
          <p className="text-center text-xs text-faint">
            Loading catalog… (first visit needs network once)
          </p>
        </div>
      )}

      {ORDER.map((cat) => {
        const rows = manifest?.systems.filter((s) => s.category === cat) ?? [];
        if (!rows.length) return null;
        return (
          <section key={cat} className="mb-7">
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-faint">
              {CATEGORY_LABEL[cat]}
            </h2>
            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-line bg-panel/60 text-left font-mono text-[10px] uppercase tracking-wider text-faint">
                    <th className="px-4 py-2 font-medium">Image</th>
                    <th className="hidden px-4 py-2 font-medium md:table-cell">Userland</th>
                    <th className="px-4 py-2 text-right font-medium">Size</th>
                    <th className="hidden px-4 py-2 font-medium sm:table-cell">Console</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry) => {
                    const installed = systems.some((s) => s.id === entry.id);
                    const busy = busyId === entry.id;
                    return (
                      <tr
                        key={entry.id}
                        className="group border-b border-line last:border-0 transition-colors hover:bg-panel-2/50"
                      >
                        <td className="max-w-sm px-4 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium">{entry.label}</span>
                            <StatusPill tone={installed ? "ok" : "dim"}>
                              {installed ? "installed" : entry.version}
                            </StatusPill>
                            {entry.gui && <StatusPill tone="accent">gui</StatusPill>}
                          </div>
                          <p className="mt-1 line-clamp-2 max-w-md text-xs leading-relaxed text-dim">
                            {entry.description}
                          </p>
                        </td>
                        <td className="hidden px-4 py-3 align-top font-mono text-[11px] text-faint md:table-cell">
                          {FAMILY_LABEL[entry.family]}
                        </td>
                        <td className="px-4 py-3 text-right align-top font-mono text-[11px] text-faint">
                          {entry.sizeMB} MB
                        </td>
                        <td className="hidden px-4 py-3 align-top font-mono text-[11px] text-faint sm:table-cell">
                          {entry.display === "serial" ? "serial" : "vga"}
                        </td>
                        <td className="px-4 py-3 text-right align-top">
                          <Button
                            size="sm"
                            variant={installed ? "outline" : "default"}
                            disabled={busyId !== null || !manifest}
                            onClick={() => launch(entry)}
                          >
                            {busy ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" /> {Math.round(progress)}%
                              </>
                            ) : installed ? (
                              <>
                                <Play className="h-3 w-3" /> Launch
                              </>
                            ) : (
                              <>
                                <Download className="h-3 w-3" /> Install
                              </>
                            )}
                          </Button>
                          {busy && (
                            <Progress value={progress} className="mt-1.5 w-28" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {manifest && !manifest.systems.length && (
        <EmptyState
          icon={Boxes}
          title="Catalog is empty"
          body="No images were published yet. Run the mirror-images workflow to populate the release."
        />
      )}

      <ModeDialog entry={pickEntry} onDone={(m) => pickEntry && navigate(`/console/${pickEntry.id}`)} onClose={() => setPickEntry(null)} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function ModeDialog({
  entry,
  onDone,
  onClose,
}: {
  entry: CatalogEntry | null;
  onDone: (m: BootMode) => void;
  onClose: () => void;
}) {
  const [, setM] = useState<BootMode | null>(null);
  if (!entry) return null;
  const choose = (m: BootMode) => {
    localStorage.setItem(`malmox.mode.${entry.id}`, m);
    setM(m);
    onDone(m);
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Launch {entry.label}</DialogTitle>
          <DialogDescription>Choose the console for this session.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Choice title="Terminal" body="Serial console in xterm — fast and precise." onClick={() => choose("terminal")} />
          <Choice title="Display" body="VGA canvas view with keyboard and mouse." onClick={() => choose("desktop")} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Choice({
  title,
  body,
  onClick,
}: {
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-line-strong p-3.5 text-left transition-colors hover:border-accent"
    >
      <div className="text-[13px] font-semibold">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-dim">{body}</div>
    </button>
  );
}

function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  async function doImport() {
    if (!file) return;
    setBusy(true);
    try {
      const r = await importLocalImage(file, {});
      await useApp.getState().refreshSystems();
      await useApp.getState().refreshStorage();
      onOpenChange(false);
      window.location.assign(`/console/${r.meta.id}`);
    } catch (e) {
      toast("error", String(e).slice(0, 140));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import image</DialogTitle>
          <DialogDescription>
            Any .iso / .img / .raw (optionally .gz) becomes a bootable machine stored in your
            browser. Great for Windows, Android-x86, or any OS you legally own. i686 and
            32-bit guests run best; 64-bit/ARM needs a future QEMU backend.
          </DialogDescription>
        </DialogHeader>
        <input
          type="file"
          accept=".img,.raw,.gz,.iso,.bin"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full rounded-md border border-line-strong bg-panel-2 px-2 py-1.5 text-xs text-dim file:mr-3 file:rounded file:border-0 file:bg-panel file:px-2 file:py-0.5 file:text-xs file:text-ink"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!file || busy} onClick={() => void doImport()}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
