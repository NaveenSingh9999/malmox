import { useState } from "react";
import { Monitor, Shield, Wifi, Info, Trash2 } from "lucide-react";
import { useApp } from "@/store/app";
import { requestPersistentStorage } from "@/core/db";
import { PageHeader, StatusPill, toast } from "@/components/chrome";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const { persisted, usage, quota, systems } = useApp();
  const [keepAwake, setKeepAwake] = useState(
    () => localStorage.getItem("malmox.wakelock") !== "0",
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <PageHeader title="Settings" description="Machine-wide behaviour. Per-machine hardware lives under each console's toolbar." />

      <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
        <Row
          icon={Monitor}
          title="Wake lock"
          desc="Keep the screen awake while a VM runs. Re-acquires automatically when you return to the tab."
          right={
            <Switch
              checked={keepAwake}
              onCheckedChange={(v) => {
                setKeepAwake(v);
                localStorage.setItem("malmox.wakelock", v ? "1" : "0");
              }}
            />
          }
        />
        <Row
          icon={Shield}
          title="Storage"
          desc={`${systems.length} machine(s) · ${(usage / 1048576).toFixed(0)} MB of ${quota > 0 ? `${(quota / 1048576).toFixed(0)} MB` : "?"} used. Pinning prevents the browser from evicting your machines.`}
          right={
            <div className="flex items-center gap-2">
              <StatusPill tone={persisted ? "ok" : "warn"}>
                {persisted ? "pinned" : "evictable"}
              </StatusPill>
              {!persisted && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void requestPersistentStorage().then((ok) =>
                      toast(ok ? "ok" : "error", ok ? "Storage pinned" : "Permission denied"),
                    )
                  }
                >
                  Pin storage
                </Button>
              )}
            </div>
          }
        />
        <Row
          icon={Wifi}
          title="Networking"
          desc={
            <>
              Ethernet is configured per machine (console → Power-row lightning).{" "}
              <b>browser LAN</b> = virtual switch across tabs; <b>fetch</b> = serverless
              userspace TCP/IP over HTTP(S); <b>gateway</b> = any wisp:// endpoint for full
              TCP/UDP with DNS-over-HTTPS.
            </>
          }
          right={<span />}
        />
        <Row
          icon={Info}
          title="Licenses"
          desc={
            <>
              v86 BSD-2 · SeaBIOS LGPLv3 · VGABIOS LGPL · Linux GPLv2 · distro images retain
              upstream licenses. Mirrored sources are attributed per image in the catalog.
            </>
          }
          right={<span />}
        />
      </div>

      <div className="mt-6 rounded-lg border border-bad/30 p-4">
        <div className="mb-1 flex items-center gap-2 text-[13px] font-medium text-bad">
          <Trash2 className="h-4 w-4" /> Danger zone
        </div>
        <p className="mb-3 text-xs leading-relaxed text-dim">
          Wipe every machine, snapshot and ISO from this browser.
        </p>
        <WipeButton />
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  title,
  desc,
  right,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 px-4 py-3.5">
      <div className="flex min-w-0 gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div className="min-w-0">
          <div className="text-[13px] font-medium">{title}</div>
          <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-dim">{desc}</p>
        </div>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function WipeButton() {
  const [confirming, setConfirming] = useState(false);
  return confirming ? (
    <div className="flex gap-2">
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
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
  );
}
