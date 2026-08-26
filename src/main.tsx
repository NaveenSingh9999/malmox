import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppShell from "@/pages/AppShell";
import CatalogPage from "@/pages/Catalog";
import LibraryPage from "@/pages/Library";
import ConsolePage from "@/pages/Console";
import SettingsPage from "@/pages/Settings";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<CatalogPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="console/:id" element={<ConsolePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
