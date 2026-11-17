import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import type { AuthIdentity } from "@shared/auth";
import { appFetch, getDemoIdentity, isDemoMode, saveDemoIdentity } from "./lib/demo-api";
import AuthPage from "./pages/Auth";
import CompanyManager from "./pages/CompanyManager";
import PasswordRecovery from "./pages/PasswordRecovery";
import Index from "./pages/Index";
import PlatformAdminPage from "./pages/PlatformAdmin";
import NotFound from "./pages/NotFound";

function ProtectedIndex() {
  const demoMode = isDemoMode();
  const [identity, setIdentity] = useState<AuthIdentity | null | undefined>(demoMode ? getDemoIdentity() : undefined);
  const [manageCompanies, setManageCompanies] = useState(false);

  useEffect(() => {
    if (demoMode) return;
    let active = true;
    appFetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) return null;
        return await response.json() as AuthIdentity;
      })
      .then((result) => {
        if (active) setIdentity(result);
      })
      .catch(() => {
        if (active) setIdentity(null);
      });
    return () => { active = false; };
  }, [demoMode]);

  if (demoMode && !identity) return <Navigate to="/login?demo=1" replace />;
  if (demoMode && identity) {
    if (!identity.company || manageCompanies) return <CompanyManager identity={identity} onIdentityChange={(nextIdentity) => { saveDemoIdentity(nextIdentity); setIdentity(nextIdentity); }} onContinue={() => setManageCompanies(false)} />;
    return <Index identity={identity as AuthIdentity & { company: NonNullable<AuthIdentity["company"]> }} onManageCompanies={() => setManageCompanies(true)} demoMode />;
  }
  if (identity === undefined) return <main className="auth-loading">Comprobando el acceso…</main>;
  if (!identity) return <Navigate to="/register" replace />;
  if (!identity.company || manageCompanies) return <CompanyManager identity={identity} onIdentityChange={setIdentity} onContinue={() => setManageCompanies(false)} />;
  return <Index identity={identity as AuthIdentity & { company: NonNullable<AuthIdentity["company"]> }} onManageCompanies={() => setManageCompanies(true)} />;
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProtectedIndex />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/recover" element={<PasswordRecovery mode="request" />} />
          <Route path="/reset-password" element={<PasswordRecovery mode="reset" />} />
          <Route path="/register/invitation" element={<AuthPage mode="invitation" />} />
          <Route path="/admin" element={<PlatformAdminPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
