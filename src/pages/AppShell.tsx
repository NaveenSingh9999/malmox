import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { HardDrive, LayoutGrid, Package, Settings as SettingsIcon, TerminalSquare } from "lucide-react";
import { useApp } from "@/store/app";
import { formatBytes } from "@/core/binutil";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Catalog", icon: LayoutGrid },
  { to: "/library", label: "Library", icon: Package },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function AppShell() {
  const { usage, quota, persisted, online, bootstrap } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-panel/40">
        <button
          className="flex items-center gap-2 px-4 py-4 text-left"
          onClick={() => navigate("/")}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent font-mono text-[13px] font-bold text-white">
            M
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">MalMox</div>
            <div className="text-[10px] uppercase tracking-widest text-faint">
              linux in a tab
            </div>
          </div>
        </button>

        <nav className="mt-2 flex flex-col gap-px px-2">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150",
                  isActive
                    ? "bg-panel-2 text-ink"
                    : "text-dim hover:bg-panel-2/60 hover:text-ink",
                )
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3 p-4">
          <StorageMeter usage={usage} quota={quota} />
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={online ? "ok" : "warn"}>{online ? "online" : "offline"}</Badge>
            <Badge tone={persisted ? "ok" : "dim"}>
              {persisted ? "storage pinned" : "evictable"}
            </Badge>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

function StorageMeter({ usage, quota }: { usage: number; quota: number }) {
  const pct = quota > 0 ? (usage / quota) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 text-dim">
          <HardDrive className="h-3 w-3" /> storage
        </span>
        <span className="font-mono text-faint">
          {formatBytes(usage)} / {quota > 0 ? formatBytes(quota) : "?"}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

export function ConsoleIcon() {
  return <TerminalSquare className="h-3.5 w-3.5" />;
}
