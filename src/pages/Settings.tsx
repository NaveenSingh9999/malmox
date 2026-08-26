import { useState } from "react";
import { Shield, Trash2, Monitor, Wifi, Info } from "lucide-react";
import { useApp } from "@/store/app";
import { requestPersistentStorage } from "@/core/db";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const { persisted, usage, quota, systems } = useApp();
  const [keepAwake, setKeepAwake] = useState(true);

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
      <p className="mb-6 mt-1 text-xs text-dim">Machine-wide behaviour.</p>

      <div className="grid gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-accent" /> Wake lock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-dim">
                Keep screen awake while a VM is running
              </span>
              <Switch
                checked={keepAwake}
                onCheckedChange={(v) => {
                  setKeepAwake(v);
                  localStorage.setItem("malmox.wakelock", v ? "1" : "0");
                }}
              />
            </div>
            <p className="text-xs leading-relaxed text-faint">
              Uses the Screen Wake Lock API and re-acquires automatically when you return
              to the tab.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" /> Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-dim">Persistent storage</span>
              <Badge tone={persisted ? "ok" : "warn"}>
                {persisted ? "pinned — safe from eviction" : "evictable"}
              </Badge>
            </div>
            {!persisted && (
              <Button size="sm" variant="outline" onClick={() => void requestPersistentStorage()}>
                Request persistent storage
              </Button>
            )}
            <div className="font-mono text-[11px] text-faint">
              {systems.length} system(s) · {(usage / 1048576).toFixed(0)} MB of{" "}
              {quota > 0 ? `${(quota / 1048576).toFixed(0)} MB` : "?"} used
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-accent" /> Networking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs leading-relaxed text-dim">
            <p>
              Ethernet is configured per machine under the lightning icon in the console
              toolbar. Backends:
            </p>
            <ul className="list-inside list-disc space-y-1 font-mono text-[11px]">
              <li><b>browser LAN</b> — virtual switch across MalMox tabs (serverless)</li>
              <li><b>fetch stack</b> — userspace TCP/IP over fetch(), serverless HTTP(S)</li>
              <li><b>gateway</b> — point at any wisp:// endpoint for full TCP/UDP internet</li>
            </ul>
            <p className="pt-1 text-faint">
              Browsers cannot emit raw ethernet frames; these backends are the complete
              set of egress paths that exist. The emulated NIC itself (virtio / NE2000) is
              always real hardware emulation visible to the guest kernel.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Info className="h-4 w-4 text-accent" /> About
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs leading-relaxed text-dim">
            <p>
              MalMox runs a full 32-bit x86 PC via v86 (BSD-2). Linux kernels are GPLv2;
              distro images retain their own licenses. SeaBIOS/VGABIOS are LGPL.
            </p>
            <p className="font-mono text-[11px] text-faint">
              i686 userland only — this is a property of browser CPU emulation, not a
              limitation of your device.
            </p>
          </CardContent>
        </Card>

        <DangerZone />
      </div>
    </div>
  );
}

function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  return (
    <Card className="border-bad/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-bad">
          <Trash2 className="h-4 w-4" /> Danger zone
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <span className="text-xs text-dim">
          Wipe every installed system, snapshot and ISO from this browser.
        </span>
        {confirming ? (
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                indexedDB.deleteDatabase("malmox");
                caches?.keys?.().then((ks) => ks.forEach((k) => k.includes("workbox") && caches.delete(k)));
                setTimeout(() => location.reload(), 400);
              }}
            >
              Confirm wipe
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
            Wipe all data
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
