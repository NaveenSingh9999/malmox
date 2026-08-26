import { useEffect, useState } from "react";
import { X, Zap } from "lucide-react";
import { getSystem, putSystem } from "@/core/db";
import type { HardwareConfig, NetBackend, NicType } from "@/core/types";
import { RAM_PRESETS } from "@/core/types";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
}: {
  metaId: string;
  onClose: () => void;
  live?: unknown;
}) {
  const [hw, setHw] = useState<HardwareConfig | null>(null);
  const [dirty, setDirty] = useState(false);

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

  return (
    <div className="space-y-4 overflow-y-auto rounded-lg border border-line-strong bg-panel p-4 shadow-2xl">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-faint">
          <Zap className="h-3 w-3" /> machine settings
        </span>
        <button className="text-faint transition-colors hover:text-ink" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-1.5">
        <Label>memory — {hw.ramMB} MB (next boot)</Label>
        <input
          type="range"
          min={32}
          max={2048}
          step={32}
          value={hw.ramMB}
          onChange={(e) => patch({ ramMB: Number(e.target.value) })}
          className="w-full accent-[#5e6ad2]"
        />
        <div className="flex gap-1">
          {RAM_PRESETS.map((r) => (
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
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>VGA memory</Label>
          <Select value={String(hw.vgaMB)} onValueChange={(v) => patch({ vgaMB: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2, 4, 8, 16, 32].map((v) => (
                <SelectItem key={v} value={String(v)}>{v} MB</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>NIC</Label>
          <Select value={hw.nicType} onValueChange={(v: NicType) => patch({ nicType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="virtio">virtio</SelectItem>
              <SelectItem value="ne2k">NE2000</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Ethernet backend</Label>
        <Select value={hw.netBackend} onValueChange={(v: NetBackend) => patch({ netBackend: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="off">offline</SelectItem>
            <SelectItem value="lan">browser LAN — cross-tab switch</SelectItem>
            <SelectItem value="fetch">fetch — serverless HTTP(S) web</SelectItem>
            <SelectItem value="wisp">gateway — wisp:// full TCP/UDP</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] leading-tight text-faint">
          <span className="text-ink">fetch</span> gives real web access out of the box.
          <span className="text-ink"> wisp</span> gives full TCP/UDP (SSH, etc.) but needs a
          gateway URL below.
        </p>
      </div>

      {(hw.netBackend === "wisp" || hw.netBackend === "fetch") && (
        <>
          {hw.netBackend === "wisp" && (
            <>
              <input
                placeholder="wisp://your-gateway-host:8080"
                value={hw.gatewayUrl}
                onChange={(e) => patch({ gatewayUrl: e.target.value })}
                className="h-8 w-full rounded-md border border-line-strong bg-panel-2 px-2.5 text-[13px] text-ink placeholder:text-faint focus:border-accent"
              />
              <button
                type="button"
                onClick={() => patch({ netBackend: "wisp", gatewayUrl: "wss://wisp.mercurywork.sh/" })}
                className="self-start rounded border border-line-strong px-2 py-0.5 font-mono text-[10px] text-faint transition-colors hover:text-ink"
              >
                use public relay
              </button>
            </>
          )}
          <label className="flex items-center justify-between text-[13px] text-dim">
            DNS over HTTPS
            <Switch checked={hw.doh} onCheckedChange={(v) => patch({ doh: v })} />
          </label>
        </>
      )}

      <label className="flex items-center justify-between text-[13px] text-dim">
        ACPI
        <Switch checked={hw.acpi} onCheckedChange={(v) => patch({ acpi: v })} />
      </label>
      <label className="flex items-center justify-between text-[13px] text-dim">
        PC speaker
        <Switch checked={hw.speaker} onCheckedChange={(v) => patch({ speaker: v })} />
      </label>
      <label className="flex items-center justify-between text-[13px] text-dim">
        disable JIT (compat mode)
        <Switch checked={hw.disableJit} onCheckedChange={(v) => patch({ disableJit: v })} />
      </label>

      <div className="flex items-center justify-between pt-1">
        <span className="font-mono text-[10px] text-faint">
          {dirty ? "unsaved changes" : "saved"}
        </span>
        <Button size="sm" disabled={!dirty} onClick={() => void save()}>
          Save & reboot later
        </Button>
      </div>
    </div>
  );
}
