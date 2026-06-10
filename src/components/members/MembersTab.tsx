"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Crown,
  UserMinus,
  Copy,
  Share2,
  Users,
  Shield,
  Check,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTrip } from "@/lib/trip-context";
import { cn, getInitials, formatCurrency } from "@/lib/utils";

export default function MembersTab() {
  const supabase = createClient();
  const {
    trip,
    members,
    expenses,
    isAdmin,
    currentUserId,
    refreshTrip,
    refreshMembers,
  } = useTrip();

  const [copied, setCopied] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  // ─── Compute per-member stats ─────────────────
  const memberStats = useMemo(() => {
    const stats = new Map<string, { expensesAdded: number; amountPaid: number }>();

    members.forEach((m) => {
      stats.set(m.user_id, { expensesAdded: 0, amountPaid: 0 });
    });

    expenses.forEach((exp) => {
      const existing = stats.get(exp.paid_by);
      if (existing) {
        existing.expensesAdded += 1;
        existing.amountPaid += exp.amount;
      }
    });

    return stats;
  }, [members, expenses]);

  // ─── Copy invite code ────────────────────────
  const copyInviteCode = useCallback(async () => {
    if (!trip) return;
    try {
      await navigator.clipboard.writeText(trip.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [trip]);

  // ─── Share invite code ────────────────────────
  const shareInviteCode = useCallback(async () => {
    if (!trip) return;
    try {
      await navigator.share({
        title: `Join ${trip.name} on TripSquad!`,
        text: `Use invite code: ${trip.invite_code} to join our trip to ${trip.destination}`,
      });
    } catch (err) {
      // User cancelled or not supported — fail silently
      console.error("Share failed:", err);
    }
  }, [trip]);

  // ─── Remove member ───────────────────────────
  const handleRemoveMember = useCallback(
    async (userId: string) => {
      if (!trip) return;
      setRemovingUserId(userId);

      try {
        const { error } = await supabase
          .from("trip_members")
          .delete()
          .eq("trip_id", trip.id)
          .eq("user_id", userId);

        if (error) throw error;

        await refreshTrip();
        await refreshMembers();
      } catch (err) {
        console.error("Error removing member:", err);
      } finally {
        setRemovingUserId(null);
        setConfirmRemove(null);
      }
    },
    [supabase, trip, refreshTrip, refreshMembers]
  );

  if (!trip) return null;

  return (
    <div className="space-y-8">
      {/* ─── Members List ─────────────────────────── */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Members</h2>
          <span className="badge badge-info">{members.length}</span>
        </div>

        <div className="space-y-3">
          {members.map((member, idx) => {
            const stats = memberStats.get(member.user_id);
            const isCurrentUser = member.user_id === currentUserId;

            return (
              <div
                key={member.user_id}
                className="glass-card animate-fade-in p-4"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative">
                    {member.user.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.user.avatar_url}
                        alt={member.user.full_name}
                        className="h-11 w-11 rounded-full object-cover ring-2 ring-border"
                      />
                    ) : (
                      <div className="avatar avatar-lg">
                        {getInitials(member.user.full_name)}
                      </div>
                    )}
                    {/* Online indicator */}
                    <div
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card",
                        isCurrentUser
                          ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                          : "bg-gray-500"
                      )}
                    />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-foreground">
                        {member.user.full_name}
                        {isCurrentUser && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (You)
                          </span>
                        )}
                      </p>
                      {/* Role Badge */}
                      {member.role === "admin" ? (
                        <span className="badge bg-purple-500/10 text-purple-600">
                          <Crown className="h-3 w-3" />
                          Admin
                        </span>
                      ) : (
                        <span className="badge bg-blue-500/10 text-blue-600">
                          <Shield className="h-3 w-3" />
                          Member
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.user.email}
                    </p>
                  </div>

                  {/* Stats */}
                  {stats && (
                    <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="text-center">
                        <p className="font-semibold text-foreground">
                          {stats.expensesAdded}
                        </p>
                        <p>expenses</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-emerald-600">
                          {formatCurrency(stats.amountPaid)}
                        </p>
                        <p>paid</p>
                      </div>
                    </div>
                  )}

                  {/* Admin: Remove Member */}
                  {isAdmin && !isCurrentUser && member.role !== "admin" && (
                    <div>
                      {confirmRemove === member.user_id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              handleRemoveMember(member.user_id)
                            }
                            disabled={removingUserId === member.user_id}
                            className="flex h-8 items-center gap-1 rounded-lg bg-danger/20 px-2 text-xs font-medium text-danger transition-colors hover:bg-danger/30 disabled:opacity-50"
                          >
                            {removingUserId === member.user_id ? (
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-danger border-t-transparent" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmRemove(null)}
                            className="flex h-8 items-center rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRemove(member.user_id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                          title="Remove member"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Mobile Stats */}
                {stats && (
                  <div className="mt-3 flex gap-4 border-t border-border pt-3 sm:hidden">
                    <div className="flex-1 text-center text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground">
                        {stats.expensesAdded}
                      </p>
                      <p>expenses added</p>
                    </div>
                    <div className="flex-1 text-center text-xs text-muted-foreground">
                      <p className="font-semibold text-emerald-600">
                        {formatCurrency(stats.amountPaid)}
                      </p>
                      <p>amount paid</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Invite Section ───────────────────────── */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Share2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Invite Friends
          </h2>
        </div>

        <div className="glass-card p-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Share this code with friends to invite them to your trip.
          </p>

          {/* Invite Code Display */}
          <div className="mb-4 flex items-center justify-center rounded-2xl bg-secondary/60 px-6 py-5 border border-border">
            <span className="font-mono text-3xl font-bold tracking-[0.3em] gradient-text">
              {trip.invite_code}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={copyInviteCode}
              className={cn(
                "btn-secondary flex flex-1 items-center justify-center gap-2 transition-all",
                copied && "border-emerald-500/50 bg-emerald-500/10 text-emerald-600"
              )}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Code
                </>
              )}
            </button>

            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                onClick={shareInviteCode}
                className="btn-glow flex flex-1 items-center justify-center gap-2"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
