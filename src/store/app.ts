import { create } from "zustand";
import type { SystemMeta } from "@/core/types";
import {
  listSystems,
  storageUsage,
  requestPersistentStorage,
} from "@/core/db";
import { loadManifest } from "@/core/catalog";
import type { Manifest } from "@/core/types";

interface AppState {
  systems: SystemMeta[];
  manifest: Manifest | null;
  usage: number;
  quota: number;
  persisted: boolean;
  online: boolean;
  refreshSystems: () => Promise<void>;
  refreshStorage: () => Promise<void>;
  bootstrap: () => Promise<void>;
  setOnline: (v: boolean) => void;
}

export const useApp = create<AppState>((set) => ({
  systems: [],
  manifest: null,
  usage: 0,
  quota: 0,
  persisted: false,
  online: navigator.onLine,
  async refreshSystems() {
    set({ systems: await listSystems() });
  },
  async refreshStorage() {
    const { usage, quota } = await storageUsage();
    const persisted =
      (await navigator.storage?.persisted?.()) ?? false;
    set({ usage, quota, persisted });
  },
  async bootstrap() {
    try {
      const manifest = await loadManifest();
      set({ manifest });
    } catch {
      /* offline first run */
    }
    const persisted = await requestPersistentStorage();
    set({ persisted });
    await Promise.all([useApp.getState().refreshSystems(), useApp.getState().refreshStorage()]);
    window.addEventListener("online", () => useApp.getState().setOnline(true));
    window.addEventListener("offline", () => useApp.getState().setOnline(false));
  },
  setOnline(v) {
    set({ online: v });
  },
}));
