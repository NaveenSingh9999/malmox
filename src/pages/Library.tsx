import { Link } from "react-router-dom";
import { Play, Trash2, RotateCcw, Boxes, MoreHorizontal } from "lucide-react";
import { useApp } from "@/store/app";
import { FAMILY_LABEL } from "@/core/types";
import { uninstall } from "@/core/install";
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

  async function remove(id: string, label: string) {
    if (!confirm(`Delete "${label}"? Disk data and snapshots are erased.`)) return;
    await uninstall(id);
    await Promise.all([refreshSystems(), refreshStorage()]);
    toast("info", `${label} deleted`);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader
        title="Machines"
        description="Installed systems and their live configuration. Snapshots restore sessions instantly after a reload."
      />

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
