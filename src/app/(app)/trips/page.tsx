'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, UserPlus, Search, Compass } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { Trip } from '@/lib/types';
import TripCard from '@/components/trips/TripCard';
import CreateTripModal from '@/components/trips/CreateTripModal';
import JoinTripModal from '@/components/trips/JoinTripModal';

type TripWithStats = Trip & {
  memberCount: number;
  totalExpenses: number;
};

type FilterType = 'all' | 'active' | 'upcoming' | 'past';

export default function TripsPage() {
  const { profile } = useAuth();
  const [trips, setTrips] = useState<TripWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const fetchTrips = useCallback(async () => {
    try {
      const supabase = createClient();
      if (!profile?.id) return;

      const { data: memberData, error: memberError } = await supabase
        .from('trip_members')
        .select('trip_id')
        .eq('user_id', profile.id);

      if (memberError) throw memberError;
      if (!memberData || memberData.length === 0) {
        setTrips([]);
        setLoading(false);
        return;
      }

      const tripIds = memberData.map((m) => m.trip_id);

      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .in('id', tripIds)
        .order('start_date', { ascending: true });

      if (tripsError) throw tripsError;

      const { data: memberCounts } = await supabase
        .from('trip_members')
        .select('trip_id')
        .in('trip_id', tripIds);

      const { data: expensesData } = await supabase
        .from('expenses')
        .select('trip_id, amount')
        .in('trip_id', tripIds);

      const memberCountMap = new Map<string, number>();
      if (memberCounts) {
        for (const m of memberCounts) {
          memberCountMap.set(m.trip_id, (memberCountMap.get(m.trip_id) ?? 0) + 1);
        }
      }

      const expenseTotalMap = new Map<string, number>();
      if (expensesData) {
        for (const e of expensesData) {
          expenseTotalMap.set(e.trip_id, (expenseTotalMap.get(e.trip_id) ?? 0) + Number(e.amount));
        }
      }

      const tripsWithStats: TripWithStats[] = (tripsData ?? []).map((trip: Trip) => ({
        ...trip,
        memberCount: memberCountMap.get(trip.id) ?? 0,
        totalExpenses: expenseTotalMap.get(trip.id) ?? 0,
      }));

      setTrips(tripsWithStats);
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.id) {
      fetchTrips();
    }
  }, [profile?.id, fetchTrips]);

  const filteredTrips = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return trips.filter((trip) => {
      // Search query filter
      const matchesSearch =
        trip.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (trip.description && trip.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Date status filter
      const startDate = new Date(trip.start_date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(trip.end_date);
      endDate.setHours(23, 59, 59, 999);

      if (activeFilter === 'active') {
        return startDate <= today && endDate >= today;
      }
      if (activeFilter === 'upcoming') {
        return startDate > today;
      }
      if (activeFilter === 'past') {
        return endDate < today;
      }
      return true;
    });
  }, [trips, searchQuery, activeFilter]);

  const counts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let active = 0;
    let upcoming = 0;
    let past = 0;

    trips.forEach((trip) => {
      const startDate = new Date(trip.start_date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(trip.end_date);
      endDate.setHours(23, 59, 59, 999);

      if (startDate <= today && endDate >= today) {
        active++;
      } else if (startDate > today) {
        upcoming++;
      } else if (endDate < today) {
        past++;
      }
    });

    return { all: trips.length, active, upcoming, past };
  }, [trips]);

  return (
    <div className="min-h-screen bg-background bg-mesh">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 animate-fade-in">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              My Trips
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your current, upcoming, and past travel plans.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowJoinModal(true)}
              className="btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-secondary hover:bg-accent text-sm font-medium transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Join Trip
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-glow flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              Create Trip
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 animate-slide-up">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/30 border border-border/50 max-w-full overflow-x-auto shrink-0">
            {(['all', 'active', 'upcoming', 'past'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                  activeFilter === filter
                    ? 'bg-primary text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-slate-100'
                }`}
              >
                {filter} ({counts[filter]})
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by trip name or destination..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary/20 border border-border/50 text-foreground placeholder:text-muted-foreground/60 text-sm focus:outline-none focus:border-indigo-500/60 transition-colors input-dark"
            />
          </div>
        </div>

        {/* Trips Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20"></div>
              <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin"></div>
            </div>
            <p className="text-muted-foreground mt-4 text-sm font-medium animate-pulse">
              Loading your trips...
            </p>
          </div>
        ) : filteredTrips.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {filteredTrips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                memberCount={trip.memberCount}
                totalExpenses={trip.totalExpenses}
              />
            ))}
          </div>
        ) : (
          <div className="glass-card flex flex-col items-center justify-center text-center p-12 py-20 rounded-2xl border border-border/40 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-secondary/50 border border-border flex items-center justify-center mb-4 text-blue-500">
              <Compass className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No trips found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              {searchQuery || activeFilter !== 'all'
                ? "We couldn't find any trips matching your search filter."
                : "You haven't joined or created any trips yet. Start planning today!"}
            </p>
            {!searchQuery && activeFilter === 'all' && (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="btn-secondary px-5 py-2.5 rounded-xl border border-border hover:bg-accent text-sm font-medium transition-all"
                >
                  Join with Code
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-glow px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                >
                  Plan a Trip
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateTripModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false);
          fetchTrips();
        }}
      />
      <JoinTripModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoined={() => {
          setShowJoinModal(false);
          fetchTrips();
        }}
      />
    </div>
  );
}
