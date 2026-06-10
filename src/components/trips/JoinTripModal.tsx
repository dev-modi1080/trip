"use client";

import { useState, type FormEvent, type ChangeEvent } from "react";
import { X, Ticket, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Trip } from "@/lib/types";
import { notifyMemberJoined } from "@/lib/notifications";

type JoinTripModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onJoined: () => void;
};

export default function JoinTripModal({
  isOpen,
  onClose,
  onJoined,
}: JoinTripModalProps) {
  const { authUser } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundTrip, setFoundTrip] = useState<Trip | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setCode("");
    setError(null);
    setFoundTrip(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCodeChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (value.length > 6) return;
    setCode(value);
    setError(null);
    setFoundTrip(null);

    // Auto-lookup when code is 6 characters
    if (value.length === 6) {
      try {
        const supabase = createClient();
        const { data, error: lookupError } = await supabase
          .from("trips")
          .select("*")
          .eq("invite_code", value)
          .single();

        if (lookupError || !data) {
          setError("Invalid invite code. Please check and try again.");
          return;
        }

        setFoundTrip(data as Trip);
      } catch {
        setError("Failed to look up invite code.");
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser || !foundTrip) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from("trip_members")
        .select("trip_id")
        .eq("trip_id", foundTrip.id)
        .eq("user_id", authUser.id)
        .single();

      if (existingMember) {
        setError("You are already a member of this trip.");
        setLoading(false);
        return;
      }

      // Join the trip
      const { error: joinError } = await supabase
        .from("trip_members")
        .insert({
          trip_id: foundTrip.id,
          user_id: authUser.id,
          role: "member",
        });

      if (joinError) throw joinError;

      // Send notification to existing members
      try {
        const { data: existingMembers } = await supabase
          .from('trip_members')
          .select('user_id')
          .eq('trip_id', foundTrip.id);

        if (existingMembers && authUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', authUser.id)
            .single();

          await notifyMemberJoined(
            foundTrip.id,
            profile?.full_name ?? 'Someone',
            existingMembers.map((m) => m.user_id),
            authUser.id
          );
        }
      } catch (notifErr) {
        console.error('Failed to send join notifications:', notifErr);
      }

      resetForm();
      onJoined();
    } catch (err) {
      console.error("Error joining trip:", err);
      setError("Failed to join trip. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Ticket className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Join a Trip</h2>
              <p className="text-xs text-muted-foreground">
                Enter the 6-character invite code
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Invite Code Input */}
          <div className="flex flex-col items-center">
            <input
              type="text"
              value={code}
              onChange={handleCodeChange}
              placeholder="XXXXXX"
              className="w-full text-center text-3xl font-mono font-bold tracking-[0.5em] py-4 px-6 bg-secondary border-2 border-border rounded-2xl text-foreground outline-none transition-all duration-300 focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] placeholder:text-muted-foreground/40 placeholder:tracking-[0.5em]"
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Ask the trip admin for the invite code
            </p>
          </div>

          {/* Trip Preview */}
          {foundTrip && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 animate-scale-in">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">
                  Trip Found!
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground">
                {foundTrip.name}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                📍 {foundTrip.destination}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-glow flex-1"
              disabled={loading || !foundTrip}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Joining...
                </span>
              ) : (
                "Join Trip"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
