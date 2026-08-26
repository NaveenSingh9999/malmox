import { Link } from "react-router-dom";
import { Play, Trash2, RotateCcw, TerminalSquare } from "lucide-react";
import { useApp } from "@/store/app";
import { OS_META } from "@/core/types";
import { uninstall } from "@/core/install";
import { clearSnapshot } from "@/core/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/core/binutil";

export default function LibraryPage() {
  const { systems, refreshSystems, refreshStorage } = useApp();

  async function remove(id: string) {
    await uninstall(id);
    await Promise.all([refreshSystems(), refreshStorage()]);
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <h1 className="text-lg font-semibold tracking-tight">Library</h1>
      <p className="mb-6 mt-1 text-xs text-dim">
        Installed systems live in your browser storage. Snapshots resume sessions instantly.
      </p>

      {!systems.length && (
        <Card>
          <CardContent className="flex items-center justify-between pt-4">
            <span className="text-xs text-dim">Nothing installed yet.</span>
            <Button size="sm" asChild>
              <Link to="/">Browse catalog</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {systems.map((s) => (
          <Card key={s.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: OS_META[s.os].accent }}
                />
                <CardTitle>{s.label}</CardTitle>
                <Badge tone="dim">{s.version}</Badge>
                <Badge tone={s.snapshotAt ? "ok" : "dim"}>
                  {s.snapshotAt ? "snapshot saved" : "no snapshot"}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" asChild>
                  <Link to={`/console/${s.id}`}>
                    <Play className="h-3 w-3" /> Boot
                  </Link>
                </Button>
                {!s.snapshotAt ? null : (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Discard snapshot"
                    onClick={async () => {
                      await clearSnapshot(s.id);
                      await useApp.getState().refreshSystems();
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void remove(s.id)}
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-faint">
                <span>ram {s.hardware.ramMB} MB</span>
                <span>disk {formatBytes(s.sizeBytes)}</span>
                <span>nic {s.hardware.nicType}</span>
                <span>net {s.hardware.netBackend}</span>
                <span className="flex items-center gap-1">
                  <TerminalSquare className="h-3 w-3" />
                  {new Date(s.installedAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
