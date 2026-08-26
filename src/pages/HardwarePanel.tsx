import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getSystem, putSystem, deleteDiskChunks, writeDiskChunks } from "@/core/db";
import type { HardwareConfig, NetBackend, NicType } from "@/core/types";
import { RAM_OPTIONS } from "@/core/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function HardwarePanel({
  metaId,
  onClose,
  live,
}: {
  metaId: string;
  onClose: () => void;
  live?: { mouseEnabled(v: boolean): void };
}) {
  const [hw, setHw] = useState<HardwareConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    void getSystem(metaId).then((m) => m && setHw(m.hardware));
  }, [metaId]);

  if (!hw) return null;

  const patch = (p: Partial<HardwareConfig>) => {
    setHw({ ...hw, ...p });
    setDirty(true);
  };

  async function save() {
    if (!hw) return;
    const m = await getSystem(metaId);
    if (m) await putSystem({ ...m, hardware: hw });
    setDirty(false);
    onClose();
  }

  async function resizeDisk(mb: number) {
    setResizing(true);
    try {
      const m = await getSystem(metaId);
      if (!m) return;
      const old = await import("@/core/install").then((i) =>
        i.materializeDisk(metaId, m.hardware.diskMB * 1024 * 1024),
      );
      let grown: ArrayBuffer;
      if (mb * 1024 * 1024 > old.byteLength) {
        const bigger = new Uint8Array(mb * 1024 * 1024);
        bigger.set(new Uint8Array(old));
        grown = bigger.buffer;
      } else {
        grown = old.slice(0, mb * 1024 * 1024);
      }
      await deleteDiskChunks(metaId);
      await writeDiskChunks(metaId, grown);
      const next = { ...m, hardware: { ...m.hardware, diskMB: mb }, sizeBytes: grown.byteLength };
      await putSystem(next);
      patch({ diskMB: mb });
      setDirty(true);
    } finally {
      setResizing(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-line-strong bg-panel p-4 shadow-2xl">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-faint">
          hardware
        </span>
        <button className="text-faint hover:text-ink" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <Field label={`memory — ${hw.ramMB} MB`}>
        <input
          type="range"
          min={32}
          max={2048}
          step={32}
          value={hw.ramMB}
          onChange={(e) => patch({ ramMB: Number(e.target.value) })}
          className="w-full accent-[#5e6ad2]"
        />
        <div className="mt-1 flex gap-1">
          {RAM_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => patch({ ramMB: r })}
              className={
                "rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors " +
                (hw.ramMB === r
                  ? "border-accent text-accent"
                  : "border-line-strong text-faint hover:text-ink")
              }
            >
              {r}M
            </button>
          ))}
        </div>
      </Field>

      <Field label={`vga memory — ${hw.vgaMB} MB`}>
        <Select value={String(hw.vgaMB)} onValueChange={(v) => patch({ vgaMB: Number(v) })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2, 4, 8, 16, 32].map((v) => (
              <SelectItem key={v} value={String(v)}>{v} MB</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="disk size — applies on next boot">
        <div className="flex gap-1.5">
          <Input
            type="number"
            defaultValue={hw.diskMB}
            min={32}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v && v !== hw.diskMB) void resizeDisk(v);
            }}
            disabled={resizing}
          />
          <Badge tone={resizing ? "warn" : "dim"}>MB</Badge>
        </div>
      </Field>

      <Field label="network interface card">
        <Select value={hw.nicType} onValueChange={(v: NicType) => patch({ nicType: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="virtio">virtio (modern guests)</SelectItem>
            <SelectItem value="ne2k">NE2000 (legacy guests)</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="ethernet backend">
        <Select
          value={hw.netBackend}
          onValueChange={(v: NetBackend) => patch({ netBackend: v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="off">offline</SelectItem>
            <SelectItem value="lan">browser LAN — VMs across tabs</SelectItem>
            <SelectItem value="fetch">fetch stack — serverless HTTP(S)</SelectItem>
            <SelectItem value="wisp">gateway — wisp:// endpoint</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {(hw.netBackend === "wisp" || hw.netBackend === "fetch") && (
        <>
          {hw.netBackend === "wisp" && (
            <Field label="gateway url">
              <Input
                placeholder="wisps://host:port"
                value={hw.gatewayUrl}
                onChange={(e) => patch({ gatewayUrl: e.target.value })}
              />
            </Field>
          )}
          <Field label="cors proxy (optional)">
            <Input
              placeholder="https://proxy/?url="
              value={hw.corsProxy}
              onChange={(e) => patch({ corsProxy: e.target.value })}
            />
          </Field>
          <Toggle
            label="DNS over HTTPS"
            checked={hw.doh}
            onChange={(v) => patch({ doh: v })}
          />
        </>
      )}

      <Toggle label="ACPI power management" checked={hw.acpi} onChange={(v) => patch({ acpi: v })} />
      <Toggle label="PC speaker" checked={hw.speaker} onChange={(v) => patch({ speaker: v })} />
      <Toggle
        label="disable JIT (slower, more compatible)"
        checked={hw.disableJit}
        onChange={(v) => patch({ disableJit: v })}
      />

      <div className="flex items-center justify-between pt-1">
        <span className="font-mono text-[10px] text-faint">
          changes apply to next boot{dirty ? " · unsaved" : ""}
        </span>
        <Button size="sm" disabled={!dirty || resizing} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-dim">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
