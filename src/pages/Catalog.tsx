import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, Monitor, SquareTerminal, HardDriveDownload, Cpu, MemoryStick, Package } from "lucide-react";
import { useApp } from "@/store/app";
import { OS_META } from "@/core/types";
import type { CatalogEntry } from "@/core/types";
import { installFromCatalog, importLocalImage } from "@/core/install";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBytes } from "@/core/binutil";

export default function CatalogPage() {
  const { manifest, systems } = useApp();
  const navigate = useNavigate();
  const [installing, setInstalling] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");

  async function install(entry: CatalogEntry) {
    setError("");
    setInstalling(entry.os);
    try {
      const meta = await installFromCatalog(
        entry,
        manifest!.baseUrls.releases,
        (p) => {
          setPhase(p.phase);
          setProgress(p.total > 0 ? (p.loaded / p.total) * 100 : 0);
        },
      );
      await useApp.getState().refreshSystems();
      await useApp.getState().refreshStorage();
      void meta;
      navigate(`/console/${meta.id}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setImportOpen(false);
      setInstalling(null);
    }
  }

  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Catalog</h1>
          <p className="mt-1 text-xs text-dim">
            One-time download. Everything runs locally afterwards — no server executes
            anything.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <HardDriveDownload className="h-3.5 w-3.5" /> Import image
        </Button>
      </div>

      <div className="grid gap-3">
        {(manifest?.systems ?? []).map((entry) => {
          const installed = systems.some((s) => s.id === `${entry.os}-${entry.version}`);
          const busy = installing === entry.os;
          return (
            <Card key={entry.os} className="transition-colors duration-150 hover:border-line-strong">
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: OS_META[entry.os].accent }}
                    />
                    <CardTitle>{entry.label}</CardTitle>
                    <Badge tone={installed ? "ok" : "dim"}>
                      {installed ? "installed" : formatBytes(entry.downloadMB * 1024 * 1024)}
                    </Badge>
                    {entry.gui && <Badge tone="accent">desktop</Badge>}
                  </div>
                  <CardDescription>{entry.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {installed ? (
                    <Button size="sm" asChild>
                      <Link to={`/console/${entry.os}-${entry.version}`}>Open</Link>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={installing !== null || !manifest}
                      onClick={() => void install(entry)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Install
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-faint">
                  <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> i686 · {OS_META[entry.os].kernel}</span>
                  <span className="flex items-center gap-1"><MemoryStick className="h-3 w-3" /> {Math.round(entry.ramMB)} MB ram</span>
                  <span className="flex items-center gap-1"><Package className="h-3 w-3" /> {OS_META[entry.os].pkg}</span>
                  <span>boots in ~{entry.bootSeconds}</span>
                </div>
                {busy && (
                  <div className="mt-3 space-y-1.5">
                    <Progress value={progress} />
                    <div className="font-mono text-[10px] text-faint">{phase}…</div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {!manifest && (
          <Card>
            <CardContent className="pt-4 text-xs text-dim">
              Catalog unavailable — you are offline on first run. Connect once to fetch the
              index, or use Import image with a local file.
            </CardContent>
          </Card>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-bad/40 bg-bad/10 px-3 py-2 font-mono text-xs text-bad">
          {error}
        </div>
      )}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
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
  const [err, setErr] = useState("");

  async function doImport() {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const osGuess = /arch/i.test(file.name)
        ? "arch"
        : /alpine/i.test(file.name)
          ? "alpine"
          : /debian|ubuntu/i.test(file.name)
            ? "debian"
            : "buildroot";
      const meta = await importLocalImage(file, osGuess, "", 512, undefined, /\.iso$/i.test(file.name));
      await useApp.getState().refreshSystems();
      await useApp.getState().refreshStorage();
      onOpenChange(false);
      if (typeof meta !== "string") {
        window.location.href = `/console/${meta.id}`;
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import disk image</DialogTitle>
          <DialogDescription>
            Load a raw ext4 image or .iso (optionally gzip-compressed). i686 images boot
            best; x86_64 userland will not run.
          </DialogDescription>
        </DialogHeader>
        <input
          type="file"
          accept=".img,.raw,.gz,.iso,.bin"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full rounded-md border border-line-strong bg-panel-2 px-2 py-1.5 text-xs text-dim file:mr-3 file:rounded file:border-0 file:bg-panel file:px-2 file:py-0.5 file:text-xs file:text-ink"
        />
        {err && <p className="mt-2 font-mono text-xs text-bad">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!file || busy} onClick={() => void doImport()}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { SquareTerminal, Monitor };
