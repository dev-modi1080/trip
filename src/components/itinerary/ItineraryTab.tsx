"use client";

import { useState, useMemo } from "react";
import { Plus, MapPin, Calendar, Clock } from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { useTrip } from "@/lib/trip-context";
import { cn } from "@/lib/utils";
import type { ItineraryItem } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import ItineraryCard from "./ItineraryCard";
import AddItineraryModal from "./AddItineraryModal";
import EditItineraryModal from "./EditItineraryModal";

type DayGroup = {
  date: string;
  dayNumber: number;
  label: string;
  items: ItineraryItem[];
};

export default function ItineraryTab() {
  const { trip, itinerary, loading, refreshItinerary, currentUserId, isAdmin } = useTrip();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultDate, setModalDefaultDate] = useState<string | undefined>(
    undefined
  );
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (item: ItineraryItem) => {
    if (!confirm('Delete this activity?')) return;
    setDeletingId(item.id);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('itinerary_items').delete().eq('id', item.id);
      if (error) throw error;
      await refreshItinerary();
    } catch (err) {
      console.error('Error deleting item:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // Group itinerary items by date and compute day labels
  const dayGroups = useMemo(() => {
    if (!trip) return [];

    const tripStart = parseISO(trip.start_date);
    const grouped = new Map<string, typeof itinerary>();

    for (const item of itinerary) {
      const existing = grouped.get(item.date) ?? [];
      existing.push(item);
      grouped.set(item.date, existing);
    }

    // Also include empty days within the trip range
    const tripEnd = parseISO(trip.end_date);
    const totalDays = differenceInCalendarDays(tripEnd, tripStart) + 1;

    const groups: DayGroup[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(tripStart);
      d.setDate(d.getDate() + i);
      const dateStr = format(d, "yyyy-MM-dd");
      const dayLabel = format(d, "EEEE, d MMMM");
      const items = grouped.get(dateStr) ?? [];

      groups.push({
        date: dateStr,
        dayNumber: i + 1,
        label: dayLabel,
        items,
      });
    }

    return groups;
  }, [trip, itinerary]);

  const handleAddForDay = (date: string) => {
    setModalDefaultDate(date);
    setModalOpen(true);
  };

  const handleAddGeneric = () => {
    setModalDefaultDate(trip?.start_date);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="skeleton mb-3 h-8 w-48" />
            <div className="skeleton mb-2 h-24 w-full" />
            <div className="skeleton h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (itinerary.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="relative mb-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
              <MapPin className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div className="absolute -bottom-1 -left-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-3.5 w-3.5 text-primary/60" />
            </div>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            No itinerary yet
          </h3>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            Start planning your trip day by day. Add activities, transport,
            meals, and more to build the perfect itinerary.
          </p>
          <button onClick={handleAddGeneric} className="btn-glow flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add First Activity
          </button>
        </div>

        <AddItineraryModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          defaultDate={modalDefaultDate}
        />

        {editingItem && (
          <EditItineraryModal
            isOpen={!!editingItem}
            onClose={() => setEditingItem(null)}
            item={editingItem}
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* Header with add button */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Trip Itinerary
          </h2>
          <span className="badge badge-info">
            {itinerary.length} {itinerary.length === 1 ? "activity" : "activities"}
          </span>
        </div>
        <button onClick={handleAddGeneric} className="btn-glow flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" />
          Add Activity
        </button>
      </div>

      {/* Day-by-day Timeline */}
      <div className="space-y-8">
        {dayGroups.map((day, dayIdx) => (
          <div
            key={day.date}
            className="animate-fade-in"
            style={{ animationDelay: `${dayIdx * 0.05}s` }}
          >
            {/* Day Header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-blue-500/20">
                {day.dayNumber}
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Day {day.dayNumber}
                </h3>
                <p className="text-xs text-muted-foreground">{day.label}</p>
              </div>
            </div>

            {/* Timeline Items */}
            <div className="relative ml-5 border-l-2 border-border pl-6">
              {day.items.length > 0 ? (
                <div className="space-y-3">
                  {day.items.map((item, itemIdx) => (
                    <div key={item.id} className="relative">
                      {/* Timeline Dot */}
                      <div
                        className={cn(
                          "absolute -left-[31px] top-4 h-3 w-3 rounded-full border-2 border-background",
                          itemIdx === 0
                            ? "bg-primary shadow-md shadow-primary/30"
                            : "bg-muted-foreground/40"
                        )}
                      />
                      <ItineraryCard 
                        item={item} 
                        onEdit={setEditingItem}
                        onDelete={handleDelete}
                        canModify={isAdmin || item.created_by === currentUserId}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="relative py-4">
                  <div className="absolute -left-[31px] top-6 h-3 w-3 rounded-full border-2 border-background bg-border" />
                  <p className="text-sm italic text-muted-foreground">
                    No activities planned
                  </p>
                </div>
              )}

              {/* Add button per day */}
              <div className="relative pt-3">
                <div className="absolute -left-[31px] top-5 h-3 w-3 rounded-full border-2 border-dashed border-primary/40 bg-background" />
                <button
                  onClick={() => handleAddForDay(day.date)}
                  className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/50 hover:text-primary hover:bg-primary/5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add to Day {day.dayNumber}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AddItineraryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultDate={modalDefaultDate}
      />

      {editingItem && (
        <EditItineraryModal
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          item={editingItem}
        />
      )}
    </>
  );
}
