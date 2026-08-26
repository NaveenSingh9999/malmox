import { Link, useNavigate } from "react-router-dom";
import { Play, Trash2, RotateCcw, Boxes, MoreHorizontal, Upload } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/store/app";
import { FAMILY_LABEL } from "@/core/types";
import { uninstall, importLocalImage } from "@/core/install";
import { clearSnapshot } from "@/core/db";
import {
  PageHeader,
  StatusPill,
  EmptyState,
  Menu,
  toast,
} from "@/components/chrome";
import { Button } from "@/components/ui/button";

export default function LibraryPage() {
  const { systems, refreshSystems, refreshStorage } = useApp();
  const navigate = useNavigate();
  const [showImport, setShowImport] = useState(false);

  async function remove(id: string, label: string) {
    if (!confirm(`Delete "${label}"? Disk data and snapshots are erased.`)) return;
    await uninstall(id);
    await Promise.all([refreshSystems(), refreshStorage()]);
    toast("info", `${label} deleted`);
  }

  async function handleImport(file: File, label: string, role: string, display: string) {
    toast("info", `Storing ${file.name} locally…`);
    try {
      const res = await importLocalImage(file, {
        label: label || undefined,
        role: role as never,
        display: display as "serial" | "canvas",
      });
      await refreshSystems();
      setShowImport(false);
      navigate(`/console/${res.meta.id}`);
    } catch (e) {
      toast("error", `Import failed: ${String(e).slice(0, 120)}`);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader
        title="Machines"
        description="Installed systems and their live configuration. Snapshots restore sessions instantly after a reload."
        actions={
          <Button size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-3 w-3" /> New from file
          </Button>
        }
      />

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={handleImport}
        />
      )}

      {!systems.length ? (
        <EmptyState
          icon={Boxes}
          title="No machines yet"
          body="Install an image from the catalog — it stays in your browser and boots entirely locally."
          action={
            <Button size="sm" asChild>
              <Link to="/">Browse images</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line bg-panel/60 text-left font-mono text-[10px] uppercase tracking-wider text-faint">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Userland</th>
                <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">RAM</th>
                <th className="hidden px-4 py-2 text-right font-medium lg:table-cell">Disk</th>
                <th className="px-4 py-2 font-medium">Snapshot</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {systems.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0 transition-colors hover:bg-panel-2/50">
                  <td className="px-4 py-3">
                    <Link to={`/console/${s.id}`} className="text-[13px] font-medium hover:text-accent">
                      {s.label}
                    </Link>
                    <div className="mt-0.5 font-mono text-[10px] text-faint">{s.id}</div>
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-[11px] text-faint md:table-cell">
                    {FAMILY_LABEL[s.family]}
                  </td>
                  <td className="hidden px-4 py-3 text-right font-mono text-[11px] text-faint sm:table-cell">
                    {s.hardware.ramMB} MB
                  </td>
                  <td className="hidden px-4 py-3 text-right font-mono text-[11px] text-faint lg:table-cell">
                    {(s.sizeBytes / 1048576).toFixed(0)} MB
                  </td>
                  <td className="px-4 py-3">
                    {s.snapshotAt ? (
                      <StatusPill tone="ok">saved {age(s.snapshotAt)}</StatusPill>
                    ) : (
                      <StatusPill tone="dim">none</StatusPill>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" asChild>
                        <Link to={`/console/${s.id}`}>
                          <Play className="h-3 w-3" /> Boot
                        </Link>
                      </Button>
                      <Menu
                        trigger={
                          <span className="flex h-7 w-7 items-center justify-center rounded-md text-dim transition-colors hover:bg-panel-2 hover:text-ink">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </span>
                        }
                        items={[
                          {
                            label: s.snapshotAt ? "Discard snapshot" : "No snapshot saved",
                            hidden: !s.snapshotAt,
                            onSelect: async () => {
                              await clearSnapshot(s.id);
                              await useApp.getState().refreshSystems();
                              toast("info", "Snapshot discarded");
                            },
                          },
                          {
                            label: "Delete machine",
                            danger: true,
                            onSelect: () => void remove(s.id, s.label),
                          },
                        ]}
                      />
                      {!s.snapshotAt && (
                        <button
                          title="Discard snapshot"
                          hidden={!!s.snapshotAt}
                          className="hidden"
                          onClick={() => void clearSnapshot(s.id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <Trash2 className="hidden" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function age(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function ImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (file: File, label: string, role: string, display: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [role, setRole] = useState("cdrom");
  const [display, setDisplay] = useState("canvas");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-line bg-panel p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold">New machine from file</h3>
        <p className="mt-1 text-[12px] text-dim">
          Boot any OS you legally own (Windows, Android-x86, a custom Linux) entirely
          in your browser. The image is stored locally in IndexedDB — nothing is
          uploaded.
        </p>

        <label className="mt-4 block text-[11px] font-medium text-dim">Image file</label>
        <input
          type="file"
          accept=".iso,.img,.raw,.gz"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            if (f && !label) setLabel(f.name.replace(/\.(iso|img|raw|gz)$/i, ""));
          }}
          className="mt-1 w-full rounded-md border border-line bg-panel-2 px-2 py-1.5 text-[13px]"
        />

        <label className="mt-3 block text-[11px] font-medium text-dim">Name</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="My Windows 2000"
          className="mt-1 w-full rounded-md border border-line bg-panel-2 px-2 py-1.5 text-[13px]"
        />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-dim">Boot as</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-panel-2 px-2 py-1.5 text-[13px]"
            >
              <option value="cdrom">CD-ROM (iso)</option>
              <option value="hda">Hard disk (img)</option>
              <option value="floppy">Floppy (img)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-dim">Display</label>
            <select
              value={display}
              onChange={(e) => setDisplay(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-panel-2 px-2 py-1.5 text-[13px]"
            >
              <option value="canvas">Graphical (GUI)</option>
              <option value="serial">Serial (text)</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!file}
            onClick={() => file && onImport(file, label, role, display)}
          >
            Create & boot
          </Button>
        </div>
      </div>
    </div>
  );
}
