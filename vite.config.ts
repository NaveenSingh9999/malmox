import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "emulator/v86.wasm",
        "emulator/v86-fallback.wasm",
        "emulator/bios/seabios.bin",
        "emulator/bios/vgabios.bin",
      ],
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
      manifest: {
        name: "MalMox — Linux in a tab",
        short_name: "MalMox",
        description:
          "Real Linux systems booting in your browser. Fully client-side, persisted locally.",
        start_url: "/",
        display: "standalone",
        background_color: "#0b0c0f",
        theme_color: "#0b0c0f",
        icons: [
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  optimizeDeps: {
    exclude: ["v86"],
  },
});
