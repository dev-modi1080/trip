"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  UserPlus,
  Map as MapIcon,
  Calendar,
  Users,
  IndianRupee,
  Plane,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/utils";
import type { Trip } from "@/lib/types";
import TripCard from "@/components/trips/TripCard";
import CreateTripModal from "@/components/trips/CreateTripModal";
import JoinTripModal from "@/components/trips/JoinTripModal";

type TripWithStats = Trip & {
  memberCount: number;
  totalExpenses: number;
};

export default function DashboardPage() {
  const { profile } = useAuth();
  const [trips, setTrips] = useState<TripWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const fetchTrips = useCallback(async () => {
    try {
      const supabase = createClient();

      // Get trips the user is a member of
      const { data: memberData, error: memberError } = await supabase
        .from("trip_members")
        .select("trip_id")
        .eq("user_id", profile?.id ?? "");

      if (memberError) throw memberError;
      if (!memberData || memberData.length === 0) {
        setTrips([]);
        setLoading(false);
        return;
      }

      const tripIds = memberData.map((m) => m.trip_id);

      // Get the trips
      const { data: tripsData, error: tripsError } = await supabase
        .from("trips")
        .select("*")
        .in("id", tripIds)
        .order("created_at", { ascending: false });

      if (tripsError) throw tripsError;

      // Get member counts for each trip
      const { data: memberCounts } = await supabase
        .from("trip_members")
        .select("trip_id")
        .in("trip_id", tripIds);

      // Get expenses totals per trip
      const { data: expensesData } = await supabase
        .from("expenses")
        .select("trip_id, amount")
        .in("trip_id", tripIds);

      // Build stats maps
      const memberCountMap = new Map<string, number>();
      if (memberCounts) {
        for (const m of memberCounts) {
          memberCountMap.set(
            m.trip_id,
            (memberCountMap.get(m.trip_id) ?? 0) + 1
          );
        }
      }

      const expenseTotalMap = new Map<string, number>();
      if (expensesData) {
        for (const e of expensesData) {
          expenseTotalMap.set(
            e.trip_id,
            (expenseTotalMap.get(e.trip_id) ?? 0) + e.amount
          );
        }
      }

      const tripsWithStats: TripWithStats[] = (tripsData ?? []).map(
        (trip: Trip) => ({
          ...trip,
          memberCount: memberCountMap.get(trip.id) ?? 0,
          totalExpenses: expenseTotalMap.get(trip.id) ?? 0,
        })
      );

      setTrips(tripsWithStats);
    } catch (error) {
      console.error("Error fetching trips:", error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.id) {
      fetchTrips();
    }
  }, [profile?.id, fetchTrips]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  const totalTrips = trips.length;
  const activeTrips = trips.filter((t) => {
    const now = new Date();
    return new Date(t.start_date) <= now && new Date(t.end_date) >= now;
  }).length;
  const totalSpent = trips.reduce((sum, t) => sum + t.totalExpenses, 0);

  const stats = [
    {
      label: "Total Trips",
      value: totalTrips.toString(),
      icon: MapIcon,
      gradient: "from-blue-500 to-indigo-600",
    },
    {
      label: "Active Trips",
      value: activeTrips.toString(),
      icon: Calendar,
      gradient: "from-emerald-500 to-teal-600",
    },
    {
      label: "Total Spent",
      value: formatCurrency(totalSpent),
      icon: IndianRupee,
      gradient: "from-amber-500 to-orange-600",
    },
  ];

  return (
    <div className="min-h-screen bg-background bg-mesh">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Welcome Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-muted-foreground mt-2 text-base">
            Plan, split, and share your trips with friends
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`glass-card p-5 animate-slide-up stagger-${i + 1} opacity-0`}
              style={{ animationFillMode: "forwards" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}
                >
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-bold text-foreground">Your Trips</h2>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => setShowJoinModal(true)}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <UserPlus className="w-4 h-4" />
              Join Trip
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-glow flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Create Trip
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="glass-card overflow-hidden">
                <div className="h-28 skeleton" />
                <div className="p-5 space-y-3">
                  <div className="h-5 w-3/4 skeleton" />
                  <div className="h-4 w-1/2 skeleton" />
                  <div className="h-4 w-2/3 skeleton" />
                  <div className="flex justify-between pt-4 border-t border-border/50">
                    <div className="h-4 w-24 skeleton" />
                    <div className="h-4 w-20 skeleton" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Trips Grid */}
        {!loading && trips.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {trips.map((trip, i) => (
              <div
                key={trip.id}
                className={`animate-slide-up stagger-${Math.min(i + 1, 5)} opacity-0`}
                style={{ animationFillMode: "forwards" }}
              >
                <TripCard
                  trip={trip}
                  memberCount={trip.memberCount}
                  totalExpenses={trip.totalExpenses}
                />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && trips.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 flex items-center justify-center mb-6">
              <Plane className="w-12 h-12 text-blue-500" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              No trips yet
            </h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              Start your journey by creating a new trip or join an existing one
              with an invite code.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowJoinModal(true)}
                className="btn-secondary flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Join Trip
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-glow flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Trip
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Buttons (mobile) */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 sm:hidden z-40">
        <button
          onClick={() => setShowJoinModal(true)}
          className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center shadow-xl hover:bg-accent transition-all"
          aria-label="Join Trip"
        >
          <UserPlus className="w-5 h-5 text-muted-foreground" />
        </button>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all hover:scale-105"
          aria-label="Create Trip"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
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
