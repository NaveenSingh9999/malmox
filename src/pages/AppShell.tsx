import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useApp } from "@/store/app";
import { TopBar, SideRail, Toaster } from "@/components/chrome";

export default function AppShell() {
  const bootstrap = useApp((s) => s.bootstrap);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <SideRail />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  );
}
