import { ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  useRealtimeSync();

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto bg-background p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
