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
import Projects from "./pages/Projects.tsx";
import Tasks from "./pages/Tasks.tsx";
import Import from "./pages/Import.tsx";
import Intake from "./pages/Intake.tsx";
import SettingsPage from "./pages/Settings.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
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
            <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
            <Route path="/contacts" element={<ProtectedPage><Contacts /></ProtectedPage>} />
            <Route path="/contacts/:id" element={<ProtectedPage><ContactDetail /></ProtectedPage>} />
            <Route path="/companies" element={<ProtectedPage><Companies /></ProtectedPage>} />
            <Route path="/companies/:id" element={<ProtectedPage><CompanyDetail /></ProtectedPage>} />
            <Route path="/deals" element={<ProtectedPage><Deals /></ProtectedPage>} />
            <Route path="/projects" element={<ProtectedPage><Projects /></ProtectedPage>} />
            <Route path="/tasks" element={<ProtectedPage><Tasks /></ProtectedPage>} />
            <Route path="/import" element={<ProtectedPage><Import /></ProtectedPage>} />
            <Route path="/intake" element={<ProtectedPage><Intake /></ProtectedPage>} />
            <Route path="/settings" element={<ProtectedPage><SettingsPage /></ProtectedPage>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
