'use client';

import { useState, useEffect } from 'react';
import { X, Settings, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Trip } from '@/lib/types';

type EditTripModalProps = {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onUpdated: () => void;
  onDeleted: () => void;
};

export default function EditTripModal({
  isOpen,
  onClose,
  trip,
  onUpdated,
  onDeleted,
}: EditTripModalProps) {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && trip) {
      setName(trip.name || '');
      setDestination(trip.destination || '');
      setDescription(trip.description || '');
      setStartDate(trip.start_date || '');
      setEndDate(trip.end_date || '');
      setDeleteConfirmText('');
      setError(null);
    }
  }, [isOpen, trip]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !destination.trim() || !startDate || !endDate) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('trips')
        .update({
          name: name.trim(),
          destination: destination.trim(),
          description: description.trim() || null,
          start_date: startDate,
          end_date: endDate,
        })
        .eq('id', trip.id);

      if (updateError) throw updateError;
      onUpdated();
    } catch (err) {
      console.error('Error updating trip:', err);
      setError('Failed to update trip. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== trip.name) {
      setError('Please type the exact trip name to confirm deletion.');
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('trips')
        .delete()
        .eq('id', trip.id);

      if (deleteError) throw deleteError;
      onDeleted();
    } catch (err) {
      console.error('Error deleting trip:', err);
      setError('Failed to delete trip. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings className="h-5 w-5 text-indigo-400" />
            <span className="gradient-text">Trip Settings</span>
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2.5 text-sm text-red-400 animate-fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Trip Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-dark"
                placeholder="e.g. Summer in Paris"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Destination <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="input-dark"
                placeholder="e.g. Paris, France"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-dark resize-none"
                placeholder="Add some details about the trip..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Start Date <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-dark"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  End Date <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input-dark"
                  required
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3 border-b border-border/40 pb-6">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary px-5"
                disabled={loading || deleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-glow px-6 flex items-center gap-2"
                disabled={loading || deleting}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          </form>

          {/* Danger Zone */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">
              Danger Zone
            </h3>
            <div className="glass-card border-red-500/20 p-5 rounded-2xl bg-red-500/[0.02]">
              <h4 className="font-bold text-foreground mb-1 text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                Delete Trip
              </h4>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                This action is permanent and cannot be undone. All expenses, itinerary items, photos, and member associations will be permanently deleted.
              </p>
              
              <div className="space-y-3">
                <label className="block text-[11px] font-semibold text-muted-foreground">
                  Type <span className="text-foreground font-bold font-mono">"{trip.name}"</span> to confirm:
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="input-dark py-2 flex-1 text-sm bg-red-500/[0.05] border-red-500/10 focus:border-red-500/40"
                    placeholder="Enter trip name..."
                  />
                  <button
                    onClick={handleDelete}
                    disabled={deleteConfirmText !== trip.name || deleting}
                    className="px-5 py-2 rounded-xl text-sm font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20 hover:border-red-500/35 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete Trip
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
