import { ReactNode, useEffect, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "@/components/AppSidebar";
import { AIChatPanel } from "@/components/AIChatPanel";
import { NotificationBell } from "@/components/NotificationBell";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { getHomeRoute, getRoleLabel, type AppRole } from "@/lib/roles";

interface DashboardLayoutProps {
  children: ReactNode;
  allowedRoles?: AppRole[];
}

export function DashboardLayout({ children, allowedRoles }: DashboardLayoutProps) {
  const { user, role, profile, loading } = useAuth();

  // Anti-copy keyboard shortcut blocker
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      // Block Ctrl/Cmd + P (print), U (view source), S (save)
      if (mod && ["p", "u", "s"].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      // Block Ctrl/Cmd + A (select all) and C (copy) outside inputs
      if (mod && ["a", "c"].includes(e.key.toLowerCase())) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (!["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
          e.preventDefault();
        }
      }
      // Block F12
      if (e.key === "F12") e.preventDefault();
    };

    const ctxHandler = (e: MouseEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (!["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handler);
    document.addEventListener("contextmenu", ctxHandler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.removeEventListener("contextmenu", ctxHandler);
    };
  }, []);

  // Watermark grid positions
  const watermarkItems = useMemo(() => {
    const email = profile?.email || user?.email || "";
    if (!email) return null;
    const items: { top: number; left: number; key: number }[] = [];
    let k = 0;
    for (let row = -5; row < 110; row += 18) {
      for (let col = -10; col < 110; col += 28) {
        items.push({ top: row, left: col + ((row / 18) % 2 === 0 ? 0 : 14), key: k++ });
      }
    }
    return { email, items };
  }, [profile?.email, user?.email]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && role && !allowedRoles.includes(role as AppRole)) {
    return <Navigate to={getHomeRoute(role)} replace />;
  }

  return (
    <PresenceProvider>
    <SidebarProvider>
      <div className="min-h-screen flex w-full protected-content">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
            </div>
            <div className="flex items-center gap-3">
              <RoleSwitcher />
              <NotificationBell />
              <Badge variant="outline" className="text-xs capitalize font-normal">
                {getRoleLabel(role || '')}
              </Badge>
              <span className="text-sm font-medium hidden sm:inline">{profile?.full_name}</span>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-background p-3 sm:p-6">
            {children}
          </main>
        </div>
        <AIChatPanel />
        {watermarkItems && (
          <div className="watermark-overlay" aria-hidden="true">
            {watermarkItems.items.map((item) => (
              <span
                key={item.key}
                style={{ top: `${item.top}%`, left: `${item.left}%` }}
              >
                {watermarkItems.email}
              </span>
            ))}
          </div>
        )}
      </div>
    </SidebarProvider>
    </PresenceProvider>
  );
}
