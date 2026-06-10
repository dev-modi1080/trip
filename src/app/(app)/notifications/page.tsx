'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
  Bell, 
  Wallet, 
  CheckCircle, 
  UserPlus, 
  Calendar, 
  Camera, 
  Trash2, 
  Check, 
  Loader2 
} from 'lucide-react';
import { isToday, isYesterday, parseISO, formatDistanceToNow } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { Notification } from '@/lib/types';

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const supabase = createClient();
      if (!profile?.id) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.id) {
      fetchNotifications();
    }
  }, [profile?.id, fetchNotifications]);

  const markAsRead = async (id: string, isRead: boolean) => {
    if (isRead) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const supabase = createClient();
      if (!profile?.id) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);

      if (error) throw error;
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActioningId(id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    } finally {
      setActioningId(null);
    }
  };

  const groupedNotifications = useMemo(() => {
    const today: Notification[] = [];
    const yesterday: Notification[] = [];
    const earlier: Notification[] = [];

    notifications.forEach((notif) => {
      const date = parseISO(notif.created_at);
      if (isToday(date)) {
        today.push(notif);
      } else if (isYesterday(date)) {
        yesterday.push(notif);
      } else {
        earlier.push(notif);
      }
    });

    return [
      { title: 'Today', items: today },
      { title: 'Yesterday', items: yesterday },
      { title: 'Earlier', items: earlier },
    ].filter((group) => group.items.length > 0);
  }, [notifications]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'expense_added':
        return <Wallet className="w-5 h-5 text-orange-400" />;
      case 'settlement':
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'trip_invite':
        return <UserPlus className="w-5 h-5 text-indigo-400" />;
      case 'itinerary_update':
        return <Calendar className="w-5 h-5 text-blue-400" />;
      case 'photo_added':
        return <Camera className="w-5 h-5 text-pink-400" />;
      default:
        return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  return (
    <div className="min-h-screen bg-background bg-mesh">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8 animate-fade-in">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-purple-400 bg-clip-text text-transparent">
              Notifications
            </h1>
            <p className="text-muted-foreground mt-1">
              Stay updated with your trips and expenses.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-accent text-xs font-semibold text-foreground transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              Mark all as read
            </button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-muted-foreground mt-4 text-sm font-medium">
              Loading notifications...
            </p>
          </div>
        ) : notifications.length > 0 ? (
          <div className="space-y-8 animate-slide-up">
            {groupedNotifications.map((group) => (
              <div key={group.title} className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/60 px-1">
                  {group.title}
                </h2>
                <div className="space-y-2.5">
                  {group.items.map((notif) => {
                    const content = (
                      <div
                        onClick={() => markAsRead(notif.id, notif.is_read)}
                        className={`group relative flex items-start gap-4 p-4 rounded-xl border border-border/40 transition-all cursor-pointer ${
                          notif.is_read
                            ? 'bg-secondary/10 hover:bg-secondary/20'
                            : 'bg-indigo-500/5 hover:bg-indigo-500/10 border-indigo-500/20'
                        }`}
                      >
                        {/* Unread indicator dot */}
                        {!notif.is_read && (
                          <span className="absolute top-4 left-4 flex h-2 w-2 rounded-full bg-indigo-500 -translate-x-1/2 -translate-y-1/2" />
                        )}

                        {/* Icon */}
                        <div className="p-2.5 rounded-xl bg-secondary/50 border border-border/50 shrink-0">
                          {getNotificationIcon(notif.type)}
                        </div>

                        {/* Text Content */}
                        <div className="flex-1 min-w-0 pr-6">
                          <h4 className={`text-sm ${notif.is_read ? 'font-medium text-foreground' : 'font-semibold text-white'}`}>
                            {notif.title}
                          </h4>
                          {notif.message && (
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              {notif.message}
                            </p>
                          )}
                          <span className="text-[10px] text-muted-foreground/50 mt-2 block">
                            {formatDistanceToNow(parseISO(notif.created_at), { addSuffix: true })}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <button
                          onClick={(e) => deleteNotification(notif.id, e)}
                          disabled={actioningId === notif.id}
                          className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus:opacity-100 p-2 text-muted-foreground hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all"
                          title="Delete notification"
                        >
                          {actioningId === notif.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    );

                    return notif.trip_id ? (
                      <Link key={notif.id} href={`/trips/${notif.trip_id}`} className="block">
                        {content}
                      </Link>
                    ) : (
                      <div key={notif.id}>{content}</div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card flex flex-col items-center justify-center text-center p-12 py-20 rounded-2xl border border-border/40 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-secondary/50 border border-border flex items-center justify-center mb-4 text-muted-foreground/60">
              <Bell className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">All caught up!</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              You don't have any notifications at the moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
