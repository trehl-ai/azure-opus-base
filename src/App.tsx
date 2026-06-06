import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Login from "./pages/Login.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Contacts from "./pages/Contacts.tsx";
import Companies from "./pages/Companies.tsx";
import CompanyDetail from "./pages/CompanyDetail.tsx";
import ContactDetail from "./pages/ContactDetail.tsx";
import Campaigns from "./pages/Campaigns.tsx";
import CampaignWerteraum from "./pages/CampaignWerteraum.tsx";
import Projects from "./pages/Projects.tsx";
import ProjectDetail from "./pages/ProjectDetail.tsx";
import Tasks from "./pages/Tasks.tsx";
import Intake from "./pages/Intake.tsx";
import SettingsPage from "./pages/Settings.tsx";
import SetPassword from "./pages/SetPassword.tsx";
import AuthCallback from "./pages/AuthCallback.tsx";
import Ideas from "./pages/Ideas.tsx";
import OutlookAdminConsent from "./pages/settings/OutlookAdminConsent.tsx";
import Dsgvo from "./pages/Dsgvo.tsx";
import NotFound from "./pages/NotFound.tsx";

// Heavy routes — split into separate chunks to keep the initial bundle small.
// Dashboard pulls in recharts; Deals/Import/Compose/DealDetail are the largest trees,
// and Deals depends on xlsx via the export handler.
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Deals = lazy(() => import("./pages/Deals.tsx"));
const DealDetail = lazy(() => import("./pages/DealDetail.tsx"));
const Import = lazy(() => import("./pages/Import.tsx"));
const Compose = lazy(() => import("./pages/Compose.tsx"));

const RouteFallback = () => (
  <div className="flex h-full min-h-[400px] items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,        // 2 minutes fresh
      gcTime: 1000 * 60 * 10,           // 10 minutes gc
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

const P = ({ children, requiredRoles, requiredModule, requiredAction }: {
  children: React.ReactNode;
  requiredRoles?: string[];
  requiredModule?: string;
  requiredAction?: "read" | "write";
}) => (
  <ProtectedRoute requiredRoles={requiredRoles} requiredModule={requiredModule} requiredAction={requiredAction}>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/set-password" element={<SetPassword />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Protected routes with AppLayout */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<P><Dashboard /></P>} />
              <Route path="/contacts" element={<P><Contacts /></P>} />
              <Route path="/contacts/:id" element={<P><ContactDetail /></P>} />
              <Route path="/companies" element={<P><Companies /></P>} />
              <Route path="/companies/:id" element={<P><CompanyDetail /></P>} />
              <Route path="/deals" element={<P><Deals /></P>} />
              <Route path="/deals/:id" element={<P><DealDetail /></P>} />
              <Route path="/campaigns" element={<P><Campaigns /></P>} />
              <Route path="/campaigns/werteraum" element={<P><CampaignWerteraum /></P>} />
              <Route path="/projects" element={<P><Projects /></P>} />
              <Route path="/projects/:id" element={<P><ProjectDetail /></P>} />
              <Route path="/tasks" element={<P><Tasks /></P>} />
              <Route path="/ideas" element={<P><Ideas /></P>} />
              <Route path="/import" element={<P requiredRoles={["admin", "sales"]}><Import /></P>} />
              <Route path="/compose" element={<P><Compose /></P>} />
              <Route path="/intake" element={<P requiredRoles={["admin", "sales"]}><Intake /></P>} />
              <Route path="/settings/*" element={<P><SettingsPage /></P>} />
              <Route path="/admin/outlook-consent" element={<P><OutlookAdminConsent /></P>} />
              <Route path="/dsgvo" element={<P><Dsgvo /></P>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
    <ReactQueryDevtools initialIsOpen={false} position="bottom" buttonPosition="bottom-right" />
  </QueryClientProvider>
);

export default App;
