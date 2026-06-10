"use client";

import { useState, type FormEvent } from "react";
import { X, MapPin, Calendar, FileText, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { generateInviteCode } from "@/lib/utils";

type CreateTripModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export default function CreateTripModal({
  isOpen,
  onClose,
  onCreated,
}: CreateTripModalProps) {
  const { authUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  if (!isOpen) return null;

  const resetForm = () => {
    setName("");
    setDestination("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) return;

    if (!name.trim() || !destination.trim() || !startDate || !endDate) {
      setError("Please fill in all required fields.");
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setError("End date must be after start date.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const inviteCode = generateInviteCode();

      // 1. Insert the trip
      const { data: trip, error: tripError } = await supabase
        .from("trips")
        .insert({
          name: name.trim(),
          destination: destination.trim(),
          description: description.trim() || null,
          start_date: startDate,
          end_date: endDate,
          created_by: authUser.id,
          invite_code: inviteCode,
        })
        .select("id")
        .single();

      if (tripError) throw tripError;

      // 2. Add the creator as admin member
      const { error: memberError } = await supabase
        .from("trip_members")
        .insert({
          trip_id: trip.id,
          user_id: authUser.id,
          role: "admin",
        });

      if (memberError) throw memberError;

      resetForm();
      onCreated();
    } catch (err) {
      console.error("Error creating trip:", err);
      setError("Failed to create trip. Please try again.");
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Create New Trip
              </h2>
              <p className="text-xs text-muted-foreground">
                Plan your next adventure
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
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Trip Name */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Trip Name *
            </label>
            <input
              type="text"
              className="input-dark"
              placeholder="e.g., Goa Beach Getaway"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Destination */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              Destination *
            </label>
            <input
              type="text"
              className="input-dark"
              placeholder="e.g., Goa, India"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              Description
            </label>
            <textarea
              className="input-dark resize-none min-h-[80px]"
              placeholder="What's this trip about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                Start Date *
              </label>
              <input
                type="date"
                className="input-dark"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                End Date *
              </label>
              <input
                type="date"
                className="input-dark"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn-glow flex-1" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                "Create Trip"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
