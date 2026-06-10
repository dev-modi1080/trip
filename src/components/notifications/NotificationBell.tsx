"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell,
  BellDot,
  Receipt,
  Handshake,
  UserPlus,
  MapPin,
  Camera,
  Check,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";

const notificationIcons: Record<Notification["type"], React.ElementType> = {
  expense_added: Receipt,
  settlement: Handshake,
  trip_invite: UserPlus,
  itinerary_update: MapPin,
  photo_added: Camera,
};

const notificationColors: Record<Notification["type"], string> = {
  expense_added: "bg-orange-500/20 text-orange-400",
  settlement: "bg-emerald-500/20 text-emerald-400",
  trip_invite: "bg-violet-500/20 text-violet-400",
  itinerary_update: "bg-blue-500/20 text-blue-400",
  photo_added: "bg-pink-500/20 text-pink-400",
};

export default function NotificationBell() {
  const supabase = createClient();
  const { authUser } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // ─── Fetch notifications ─────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!authUser) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      if (data) setNotifications(data as Notification[]);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, authUser]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ─── Close on outside click ───────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // ─── Mark single as read ─────────────────────
  const markAsRead = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", id);

        if (error) throw error;

        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
      } catch (err) {
        console.error("Error marking notification as read:", err);
      }
    },
    [supabase]
  );

  // ─── Mark all as read ────────────────────────
  const markAllAsRead = useCallback(async () => {
    if (!authUser) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", authUser.id)
        .eq("is_read", false);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  }, [supabase, authUser]);

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      fetchNotifications();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={toggleDropdown}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-xl transition-all",
          "hover:bg-secondary",
          isOpen && "bg-secondary"
        )}
      >
        {unreadCount > 0 ? (
          <BellDot className="h-5 w-5 text-foreground" />
        ) : (
          <Bell className="h-5 w-5 text-muted-foreground" />
        )}

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            "absolute right-0 top-12 z-50 w-80 sm:w-96",
            "rounded-2xl border border-border bg-card shadow-2xl shadow-black/40",
            "animate-scale-in origin-top-right"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
              >
                <Check className="h-3 w-3" />
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 && (
              <div className="space-y-2 p-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 p-2">
                    <div className="skeleton h-9 w-9 shrink-0 rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-4 w-3/4" />
                      <div className="skeleton h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                  <Bell className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  No notifications yet
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground/60">
                  We&apos;ll notify you when something happens
                </p>
              </div>
            )}

            {notifications.map((notification) => {
              const Icon = notificationIcons[notification.type];
              const colorClass = notificationColors[notification.type];

              return (
                <button
                  key={notification.id}
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsRead(notification.id);
                    }
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50",
                    !notification.is_read && "bg-primary/5"
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      colorClass
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm leading-tight",
                        !notification.is_read
                          ? "font-semibold text-foreground"
                          : "font-medium text-muted-foreground"
                      )}
                    >
                      {notification.title}
                    </p>
                    {notification.message && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {notification.message}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground/60">
                      {formatDistanceToNow(
                        new Date(notification.created_at),
                        { addSuffix: true }
                      )}
                    </p>
                  </div>

                  {/* Unread Dot */}
                  {!notification.is_read && (
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
