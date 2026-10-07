import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "@/context/AuthContext";
import { SseProvider } from "@/context/SseContext";
import { TicketsProvider } from "@/context/TicketsContext";
import { BranchProvider } from "@/context/BranchContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { PresentationProvider } from "@/context/PresentationContext";
import { TooltipProvider, ToastProvider } from "@/components/ui";

import { applySettings, loadSettings } from "@/lib/settings";

import "@/styles/design-tokens.css";
import "@/styles/base.css";
import "@/styles/icon.css";

// Pulihkan preferensi (aksen dll.) sebelum render.
applySettings(loadSettings());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <SseProvider>
                <BranchProvider>
                  <TicketsProvider>
                    <PresentationProvider>
                      <App />
                    </PresentationProvider>
                  </TicketsProvider>
                </BranchProvider>
              </SseProvider>
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
);
