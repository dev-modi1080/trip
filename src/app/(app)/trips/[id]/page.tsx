"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  Wallet,
  Camera,
  Users,
  MapPin,
  Copy,
  Check,
  Share2,
  IndianRupee,
  Clock,
  Settings,
} from "lucide-react";
import { format, parseISO, differenceInDays, isWithinInterval } from "date-fns";
import { TripProvider, useTrip } from "@/lib/trip-context";
import { formatCurrency, getInitials } from "@/lib/utils";
import { getTotalExpenses } from "@/lib/expense-calculator";
import ItineraryTab from "@/components/itinerary/ItineraryTab";
import ExpenseTab from "@/components/expenses/ExpenseTab";
import PhotoTab from "@/components/photos/PhotoTab";
import MembersTab from "@/components/members/MembersTab";
import EditTripModal from "@/components/trips/EditTripModal";

type TabId = "overview" | "itinerary" | "expenses" | "photos" | "members";

const tabs: { id: TabId; label: string; icon: typeof BarChart3 }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "itinerary", label: "Itinerary", icon: Calendar },
  { id: "expenses", label: "Expenses", icon: Wallet },
  { id: "photos", label: "Photos", icon: Camera },
  { id: "members", label: "Members", icon: Users },
];

function TripDetailContent() {
  const {
    trip,
    members,
    expenses,
    settlements,
    itinerary,
    photos,
    loading,
    currentUserId,
    isAdmin,
    refreshTrip,
  } = useTrip();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const copyInviteCode = async () => {
    if (!trip) return;
    try {
      await navigator.clipboard.writeText(trip.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
  };

  const totalExpenses = useMemo(
    () => getTotalExpenses(expenses),
    [expenses]
  );

  const myBalance = useMemo(() => {
    if (!currentUserId) return 0;
    let paid = 0;
    let owed = 0;
    for (const expense of expenses) {
      if (expense.paid_by === currentUserId) {
        paid += expense.amount;
      }
      if (expense.splits) {
        for (const split of expense.splits) {
          if (split.user_id === currentUserId) {
            owed += split.amount_owed;
          }
        }
      }
    }
    // Account for settlements
    for (const s of settlements) {
      if (s.from_user === currentUserId) paid += s.amount;
      if (s.to_user === currentUserId) owed += s.amount;
    }
    return paid - owed;
  }, [expenses, settlements, currentUserId]);

  const tripDays = useMemo(() => {
    if (!trip) return 0;
    return (
      differenceInDays(parseISO(trip.end_date), parseISO(trip.start_date)) + 1
    );
  }, [trip]);

  const isActive = useMemo(() => {
    if (!trip) return false;
    const now = new Date();
    return isWithinInterval(now, {
      start: parseISO(trip.start_date),
      end: parseISO(trip.end_date),
    });
  }, [trip]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background bg-mesh flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading trip...</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-background bg-mesh flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">
            Trip not found
          </h2>
          <p className="text-muted-foreground mb-4">
            This trip may have been deleted or you don&apos;t have access.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn-glow"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-mesh">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Back Button */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">Back to Dashboard</span>
        </Link>

        {/* Trip Header */}
        <div className="glass-card p-6 sm:p-8 mb-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">
                  {trip.name}
                </h1>
                {isActive && (
                  <span className="badge badge-success flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  {trip.destination}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-sky-500" />
                  {format(parseISO(trip.start_date), "d MMM")} -{" "}
                  {format(parseISO(trip.end_date), "d MMM yyyy")}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                  {tripDays} days
                </span>
              </div>

              {/* Member avatars */}
              <div className="flex items-center gap-2 mt-4">
                <div className="flex -space-x-2">
                  {members.slice(0, 5).map((member) => (
                    <div
                      key={member.user_id}
                      className="avatar avatar-sm border-2 border-[var(--card)]"
                      title={member.user.full_name}
                    >
                      {getInitials(member.user.full_name)}
                    </div>
                  ))}
                  {members.length > 5 && (
                    <div className="avatar avatar-sm border-2 border-[var(--card)] bg-secondary text-muted-foreground text-xs">
                      +{members.length - 5}
                    </div>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {members.length} {members.length === 1 ? "member" : "members"}
                </span>
              </div>
            </div>

            {/* Invite Code + Share */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={copyInviteCode}
                className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-border rounded-xl hover:border-blue-500/50 transition-all group"
              >
                <span className="text-sm font-mono font-bold tracking-widest text-foreground">
                  {trip.invite_code}
                </span>
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                )}
              </button>
              <button
                onClick={copyInviteCode}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center hover:shadow-lg hover:shadow-blue-500/30 transition-all"
                title="Share invite code"
              >
                <Share2 className="w-4 h-4 text-white" />
              </button>
              {isAdmin && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center hover:bg-accent transition-all"
                  title="Trip Settings"
                >
                  <Settings className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>

        {trip && (
          <EditTripModal
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            trip={trip}
            onUpdated={() => {
              setShowSettings(false);
              refreshTrip();
            }}
            onDeleted={() => {
              router.push("/dashboard");
            }}
          />
        )}

        {/* Tab Navigation */}
        <div className="grid grid-cols-5 sm:flex sm:overflow-x-auto gap-1 sm:gap-1.5 mb-6 p-1.5 bg-secondary/50 rounded-2xl border border-border/50 no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 py-2 sm:px-5 sm:py-3 rounded-xl text-[10px] sm:text-sm font-bold transition-all justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                activeTab === tab.id ? "tab-active" : "tab-inactive"
              }`}
            >
              <tab.icon className="w-5 h-5 shrink-0" />
              <span className="truncate max-w-full">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="animate-fade-in">
          {/* Overview Tab (inline) */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-card p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                      <IndianRupee className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Total Expenses
                      </p>
                      <p className="text-lg font-bold text-foreground">
                        {formatCurrency(totalExpenses)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${
                        myBalance >= 0
                          ? "from-emerald-500 to-teal-600"
                          : "from-rose-500 to-pink-600"
                      } flex items-center justify-center`}
                    >
                      <Wallet className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Your Balance
                      </p>
                      <p
                        className={`text-lg font-bold ${
                          myBalance >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {myBalance >= 0 ? "+" : ""}
                        {formatCurrency(Math.abs(myBalance))}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Members</p>
                      <p className="text-lg font-bold text-foreground">
                        {members.length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="text-lg font-bold text-foreground">
                        {tripDays} days
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity Feed */}
              <div className="glass-card p-6">
                <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  Recent Activity
                </h3>

                {expenses.length === 0 &&
                itinerary.length === 0 &&
                photos.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">
                      No activity yet. Start by adding expenses or itinerary
                      items!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expenses.slice(0, 5).map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                            <Wallet className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {expense.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {expense.paid_by_user?.full_name ?? "Someone"} •{" "}
                              {format(parseISO(expense.date), "d MMM")}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-foreground flex-shrink-0 ml-3">
                          {formatCurrency(expense.amount)}
                        </span>
                      </div>
                    ))}

                    {itinerary.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {item.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(item.date), "d MMM")}
                              {item.start_time ? ` at ${item.start_time}` : ""}
                            </p>
                          </div>
                        </div>
                        <span className="badge badge-info text-xs flex-shrink-0 ml-3">
                          {item.category}
                        </span>
                      </div>
                    ))}

                    {photos.length > 0 && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <Camera className="w-4 h-4 text-emerald-400" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {photos.length} photo{photos.length !== 1 ? "s" : ""}{" "}
                          uploaded
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sub-tab Views */}
          {activeTab === "itinerary" && <ItineraryTab />}

          {activeTab === "expenses" && <ExpenseTab />}

          {activeTab === "photos" && <PhotoTab />}

          {activeTab === "members" && <MembersTab />}
        </div>
      </div>
    </div>
  );
}

export default function TripDetailPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : params?.id?.[0] ?? '';

  return (
    <TripProvider tripId={id}>
      <TripDetailContent />
    </TripProvider>
  );
}
