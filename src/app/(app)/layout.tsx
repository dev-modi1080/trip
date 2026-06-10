"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";
import ProfileModal from "@/components/layout/ProfileModal";
import {
  Plane,
  LayoutDashboard,
  Map,
  Bell,
  LogOut,
  Loader2,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trips", label: "My Trips", icon: Map },
  { href: "/notifications", label: "Notifications", icon: Bell },
] as const;

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const supabase = createClient();

  // Fetch unread notification count
  useEffect(() => {
    if (!profile) return;

    async function fetchUnreadCount() {
      try {
        const { count } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile!.id)
          .eq("is_read", false);

        setUnreadCount(count ?? 0);
      } catch (error) {
        console.error("Error fetching notification count:", error);
      }
    }

    fetchUnreadCount();

    // Subscribe to realtime notification changes
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, supabase]);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 flex h-screen w-72 flex-col border-r border-border/50",
          "glass-card rounded-none",
          // Mobile: slide-in drawer
          "transition-transform duration-300 md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ borderRadius: 0 }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-6 border-b border-border/30">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15 group-hover:bg-primary/25 transition-colors">
              <Plane className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold gradient-text">TripSquad</span>
          </Link>
          {/* Close button for mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary/15 text-primary shadow-sm shadow-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-slate-100"
                )}
              >
                <item.icon className={cn("w-5 h-5", active && "text-primary")} />
                <span>{item.label}</span>
                {item.label === "Notifications" && unreadCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger text-[11px] font-bold text-white px-1.5">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Section */}
        <div className="px-4 py-4 border-t border-border/30">
          <div className="flex items-center gap-3">
            <div
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-3 px-3 py-2 cursor-pointer rounded-xl hover:bg-slate-50 transition-colors flex-1 min-w-0"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-border"
                />
              ) : (
                <div className="avatar avatar-md">
                  {profile ? getInitials(profile.full_name) : "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {profile?.full_name ?? "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {profile?.email ?? ""}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex-shrink-0 p-2 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-all mr-2"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 min-h-screen">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-xl border-b border-border/30 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-primary" />
            <span className="text-lg font-bold gradient-text">TripSquad</span>
          </Link>
          <Link
            href="/notifications"
            className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white px-1">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        </header>

        {/* Page Content */}
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border/30 bg-card/90 backdrop-blur-xl py-2 md:hidden">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {item.label === "Notifications" && unreadCount > 0 && (
                <span className="absolute -top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
              {active && (
                <span className="absolute -bottom-1.5 w-6 h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Profile Modal */}
      <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
}
