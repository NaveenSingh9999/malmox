import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutGrid, Boxes, Settings2, ChevronRight, HardDrive, X } from "lucide-react";
import { useApp } from "@/store/app";
import { formatBytes } from "@/core/binutil";
import { cn } from "@/lib/utils";

export function TopBar() {
  const { usage, quota, online } = useApp();
  const pct = quota > 0 ? (usage / quota) * 100 : 0;
  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
      <Link to="/" className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-accent font-mono text-[12px] font-bold text-white">
          M
        </div>
        <span className="text-[13px] font-semibold tracking-tight">MalMox</span>
      </Link>
      <span className="h-4 w-px bg-line-strong" />
      <nav className="flex items-center gap-1 font-mono text-[11px] text-faint">
        <span>console</span>
        <ChevronRight className="h-3 w-3" />
        <PageCrumb />
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <div
          className="hidden items-center gap-1.5 sm:flex"
          title={`Storage: ${formatBytes(usage)} of ${quota > 0 ? formatBytes(quota) : "—"} used`}
        >
          <HardDrive className="h-3 w-3 text-faint" />
          <div className="h-1 w-16 overflow-hidden rounded-full bg-line">
            <div
              className={cn("h-full", pct > 85 ? "bg-bad" : "bg-accent")}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-faint">{formatBytes(usage)}</span>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[10px]",
            online ? "border-ok/40 bg-ok/10 text-ok" : "border-warn/40 bg-warn/10 text-warn",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", online ? "bg-ok" : "bg-warn")} />
          {online ? "online" : "offline"}
        </span>
      </div>
    </header>
  );
}

function PageCrumb() {
  const loc = useLocation();
  const name = loc.pathname === "/" ? "images" : loc.pathname.split("/")[1].replace("library", "machines");
  return <span className="text-dim">{name}</span>;
}

const RAIL = [
  { to: "/", label: "Images", icon: LayoutGrid, end: true },
  { to: "/library", label: "Machines", icon: Boxes },
  { to: "/settings", label: "Settings", icon: Settings2 },
];

export function SideRail() {
  const { systems } = useApp();
  return (
    <aside className="flex w-48 shrink-0 flex-col gap-px border-r border-line bg-panel/40 p-2">
      {RAIL.map(({ to, label, icon: Icon, end }) => (
        <RailLink key={to} to={to} end={end}>
          <Icon className="h-3.5 w-3.5" />
          <span className="flex-1">{label}</span>
          {to === "/library" && systems.length > 0 && (
            <span className="rounded bg-panel-2 px-1 font-mono text-[10px] text-faint">
              {systems.length}
            </span>
          )}
        </RailLink>
      ))}
      <div className="mt-auto p-2 font-mono text-[10px] leading-relaxed text-faint">
        i686 · wasm vm
        <br />
        client-side only
      </div>
    </aside>
  );
}

function RailLink({
  to,
  end,
  children,
}: {
  to: string;
  end?: boolean;
  children: React.ReactNode;
}) {
  return (
    <NavLink2 to={to} end={end}>
      {children}
    </NavLink2>
  );
}

function NavLink2({
  to,
  end,
  children,
}: {
  to: string;
  end?: boolean;
  children: React.ReactNode;
}) {
  const { pathname } = useLocation();
  const active = end ? pathname === to : pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150",
        active ? "bg-panel-2 text-ink" : "text-dim hover:bg-panel-2/60 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-base font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-dim">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatusPill({
  tone = "dim",
  children,
}: {
  tone?: "dim" | "ok" | "warn" | "bad" | "accent";
  children: React.ReactNode;
}) {
  const tones = {
    dim: "border-line-strong text-faint",
    ok: "border-ok/40 bg-ok/10 text-ok",
    warn: "border-warn/40 bg-warn/10 text-warn",
    bad: "border-bad/40 bg-bad/10 text-bad",
    accent: "border-accent/40 bg-accent/10 text-accent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-px font-mono text-[10px] uppercase tracking-wide",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong px-6 py-14 text-center">
      <Icon className="h-6 w-6 text-faint" />
      <div className="text-[13px] font-medium">{title}</div>
      <p className="max-w-sm text-xs leading-relaxed text-faint">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Menu({
  trigger,
  items,
  align = "right",
}: {
  trigger: React.ReactNode;
  items: { label: string; onSelect: () => void; danger?: boolean; hidden?: boolean }[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="block">
        {trigger}
      </button>
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 min-w-40 overflow-hidden rounded-md border border-line-strong bg-panel py-1 shadow-xl",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items
            .filter((i) => !i.hidden)
            .map((i) => (
              <button
                key={i.label}
                onClick={() => {
                  setOpen(false);
                  i.onSelect();
                }}
                className={cn(
                  "block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-panel-2",
                  i.danger ? "text-bad" : "text-dim hover:text-ink",
                )}
              >
                {i.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

interface ToastMsg {
  id: number;
  kind: "info" | "error" | "ok";
  text: string;
}
let pushToastFn: ((t: Omit<ToastMsg, "id">) => void) | null = null;
export const toast = (kind: ToastMsg["kind"], text: string) => pushToastFn?.({ kind, text });

export function Toaster() {
  const [msgs, setMsgs] = useState<ToastMsg[]>([]);
  useEffect(() => {
    pushToastFn = (t) => {
      const id = Date.now() + Math.random();
      setMsgs((m) => [...m.slice(-3), { ...t, id }]);
      setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), 5000);
    };
    return () => {
      pushToastFn = null;
    };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {msgs.map((m) => (
        <div
          key={m.id}
          className={cn(
            "pointer-events-auto flex items-start gap-2 rounded-md border bg-panel px-3 py-2 text-xs shadow-lg",
            m.kind === "error"
              ? "border-bad/50 text-bad"
              : m.kind === "ok"
                ? "border-ok/50 text-ok"
                : "border-line-strong text-dim",
          )}
        >
          <span className="flex-1 leading-relaxed">{m.text}</span>
          <button
            onClick={() => setMsgs((x) => x.filter((y) => y.id !== m.id))}
            className="opacity-60 hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
