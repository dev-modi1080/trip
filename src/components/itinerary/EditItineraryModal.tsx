'use client';

import { useState, useEffect } from 'react';
import { X, MapPin, Clock, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useTrip } from '@/lib/trip-context';
import type { ItineraryItem } from '@/lib/types';

type EditItineraryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  item: ItineraryItem;
};

const categories: { value: ItineraryItem['category']; label: string }[] = [
  { value: 'activity', label: '🎯 Activity' },
  { value: 'transport', label: '🚆 Transport' },
  { value: 'meal', label: '🍽️ Meal' },
  { value: 'accommodation', label: '🏨 Accommodation' },
  { value: 'sightseeing', label: '📸 Sightseeing' },
];

export default function EditItineraryModal({
  isOpen,
  onClose,
  item,
}: EditItineraryModalProps) {
  const supabase = createClient();
  const { trip, refreshItinerary } = useTrip();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [category, setCategory] = useState<ItineraryItem['category']>('activity');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && item) {
      setTitle(item.title || '');
      setDescription(item.description || '');
      setLocation(item.location || '');
      setDate(item.date || '');
      setStartTime(item.start_time || '');
      setEndTime(item.end_time || '');
      setCategory(item.category || 'activity');
      setError(null);
    }
  }, [isOpen, item]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!date) {
      setError('Date is required');
      return;
    }
    if (!trip) return;

    setLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('itinerary_items')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          date,
          start_time: startTime || null,
          end_time: endTime || null,
          category,
        })
        .eq('id', item.id);

      if (updateError) throw updateError;

      await refreshItinerary();
      onClose();
    } catch (err) {
      console.error('Error updating itinerary item:', err);
      setError('Failed to update activity. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold gradient-text">Update Activity</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Title <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Visit Eiffel Tower"
              className="input-dark"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add some details..."
              rows={3}
              className="input-dark resize-none"
            />
          </div>

          {/* Location */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Champ de Mars, Paris"
              className="input-dark"
            />
          </div>

          {/* Date */}
          <div>
            <label className="mb-1.5 text-sm font-medium text-muted-foreground block">
              Date <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-dark"
              required
            />
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input-dark"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="input-dark"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 text-sm font-medium text-muted-foreground block">
              Category
            </label>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as ItineraryItem['category'])
              }
              className="input-dark"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-glow flex-1"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Update Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
