"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Trip,
  TripMember,
  Expense,
  Settlement,
  ItineraryItem,
  TripPhoto,
  User,
} from "@/lib/types";

type TripContextType = {
  trip: Trip | null;
  members: (TripMember & { user: User })[];
  expenses: Expense[];
  settlements: Settlement[];
  itinerary: ItineraryItem[];
  photos: TripPhoto[];
  loading: boolean;
  isAdmin: boolean;
  currentUserId: string | null;
  refreshTrip: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  refreshExpenses: () => Promise<void>;
  refreshSettlements: () => Promise<void>;
  refreshItinerary: () => Promise<void>;
  refreshPhotos: () => Promise<void>;
};

const TripContext = createContext<TripContextType | null>(null);

export function TripProvider({
  tripId,
  children,
}: {
  tripId: string;
  children: ReactNode;
}) {
  const supabase = createClient();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<(TripMember & { user: User })[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const refreshTrip = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();
      if (data) setTrip(data);
    } catch (error) {
      console.error("Error fetching trip:", error);
    }
  }, [supabase, tripId]);

  const refreshMembers = useCallback(async () => {
    try {
      const { data: membersData } = await supabase
        .from("trip_members")
        .select(
          `
          *,
          user:profiles!trip_members_user_id_fkey(*)
        `
        )
        .eq("trip_id", tripId);
      if (membersData) {
        setMembers(membersData as unknown as (TripMember & { user: User })[]);
      }
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  }, [supabase, tripId]);

  const refreshExpenses = useCallback(async () => {
    try {
      const { data: expensesData } = await supabase
        .from("expenses")
        .select(
          `
          *,
          paid_by_user:profiles!expenses_paid_by_fkey(*),
          splits:expense_splits(
            *,
            user:profiles!expense_splits_user_id_fkey(*)
          )
        `
        )
        .eq("trip_id", tripId)
        .order("date", { ascending: false });
      if (expensesData) setExpenses(expensesData as unknown as Expense[]);
    } catch (error) {
      console.error("Error fetching expenses:", error);
    }
  }, [supabase, tripId]);

  const refreshSettlements = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("settlements")
        .select(
          `
          *,
          from_user_details:profiles!settlements_from_user_fkey(*),
          to_user_details:profiles!settlements_to_user_fkey(*)
        `
        )
        .eq("trip_id", tripId)
        .order("settled_at", { ascending: false });
      if (data) setSettlements(data as unknown as Settlement[]);
    } catch (error) {
      console.error("Error fetching settlements:", error);
    }
  }, [supabase, tripId]);

  const refreshItinerary = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("itinerary_items")
        .select("*")
        .eq("trip_id", tripId)
        .order("date", { ascending: true })
        .order("sort_order", { ascending: true });
      if (data) setItinerary(data as ItineraryItem[]);
    } catch (error) {
      console.error("Error fetching itinerary:", error);
    }
  }, [supabase, tripId]);

  const refreshPhotos = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("trip_photos")
        .select(
          `
          *,
          uploaded_by_user:profiles!trip_photos_uploaded_by_fkey(*)
        `
        )
        .eq("trip_id", tripId)
        .order("uploaded_at", { ascending: false });
      if (data) setPhotos(data as unknown as TripPhoto[]);
    } catch (error) {
      console.error("Error fetching photos:", error);
    }
  }, [supabase, tripId]);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      await Promise.all([
        refreshTrip(),
        refreshMembers(),
        refreshExpenses(),
        refreshSettlements(),
        refreshItinerary(),
        refreshPhotos(),
      ]);
      setLoading(false);
    };

    loadAll();
  }, [
    supabase,
    tripId,
    refreshTrip,
    refreshMembers,
    refreshExpenses,
    refreshSettlements,
    refreshItinerary,
    refreshPhotos,
  ]);

  const isAdmin =
    members.find((m) => m.user_id === currentUserId)?.role === "admin";

  return (
    <TripContext.Provider
      value={{
        trip,
        members,
        expenses,
        settlements,
        itinerary,
        photos,
        loading,
        isAdmin,
        currentUserId,
        refreshTrip,
        refreshMembers,
        refreshExpenses,
        refreshSettlements,
        refreshItinerary,
        refreshPhotos,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}

export function useTrip() {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error("useTrip must be used within a TripProvider");
  }
  return context;
}
