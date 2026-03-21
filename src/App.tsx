import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Login from "./pages/Login.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Contacts from "./pages/Contacts.tsx";
import Companies from "./pages/Companies.tsx";
import CompanyDetail from "./pages/CompanyDetail.tsx";
import ContactDetail from "./pages/ContactDetail.tsx";
import Deals from "./pages/Deals.tsx";
import DealDetail from "./pages/DealDetail.tsx";
import Projects from "./pages/Projects.tsx";
import ProjectDetail from "./pages/ProjectDetail.tsx";
import Tasks from "./pages/Tasks.tsx";
import Import from "./pages/Import.tsx";
import Intake from "./pages/Intake.tsx";
import SettingsPage from "./pages/Settings.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

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
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes with AppLayout */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<P><Dashboard /></P>} />
            <Route path="/contacts" element={<P><Contacts /></P>} />
            <Route path="/contacts/:id" element={<P><ContactDetail /></P>} />
            <Route path="/companies" element={<P><Companies /></P>} />
            <Route path="/companies/:id" element={<P><CompanyDetail /></P>} />
            <Route path="/deals" element={<P><Deals /></P>} />
            <Route path="/deals/:id" element={<P><DealDetail /></P>} />
            <Route path="/projects" element={<P><Projects /></P>} />
            <Route path="/projects/:id" element={<P><ProjectDetail /></P>} />
            <Route path="/tasks" element={<P><Tasks /></P>} />
            <Route path="/import" element={<P requiredRoles={["admin", "sales"]}><Import /></P>} />
            <Route path="/intake" element={<P requiredRoles={["admin", "sales"]}><Intake /></P>} />
            <Route path="/settings/*" element={<P><SettingsPage /></P>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
