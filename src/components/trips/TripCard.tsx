"use client";

import Link from "next/link";
import { MapPin, Users, IndianRupee, Calendar } from "lucide-react";
import { format, isWithinInterval, isBefore, parseISO } from "date-fns";
import type { Trip } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type TripCardProps = {
  trip: Trip;
  memberCount: number;
  totalExpenses: number;
};

function getTripStatus(startDate: string, endDate: string) {
  const now = new Date();
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  if (isWithinInterval(now, { start, end })) {
    return { label: "Active", className: "badge-success" };
  }
  if (isBefore(now, start)) {
    return { label: "Upcoming", className: "badge-info" };
  }
  return {
    label: "Completed",
    className: "bg-slate-100 text-slate-600",
  };
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, "d MMM")} - ${format(end, "d MMM yyyy")}`;
  }
  return `${format(start, "d MMM yyyy")} - ${format(end, "d MMM yyyy")}`;
}

export default function TripCard({
  trip,
  memberCount,
  totalExpenses,
}: TripCardProps) {
  const status = getTripStatus(trip.start_date, trip.end_date);

  return (
    <Link href={`/trips/${trip.id}`} className="block group">
      <div className="glass-card overflow-hidden relative">
        {/* Gradient overlay header */}
        <div className="h-28 bg-gradient-to-br from-blue-600/20 via-sky-500/15 to-indigo-600/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(59,130,246,0.15),transparent_70%)]" />
          <div className="absolute top-3 right-3">
            <span className={`badge ${status.className}`}>{status.label}</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[var(--card)] to-transparent" />
        </div>

        {/* Content */}
        <div className="p-5 -mt-4 relative">
          <h3 className="text-lg font-bold text-foreground group-hover:text-blue-600 transition-colors duration-300 truncate">
            {trip.name}
          </h3>

          <div className="flex items-center gap-1.5 mt-2 text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <span className="text-sm truncate">{trip.destination}</span>
          </div>

          <div className="flex items-center gap-1.5 mt-1.5 text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
            <span className="text-sm">
              {formatDateRange(trip.start_date, trip.end_date)}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span className="text-sm">
                {memberCount} {memberCount === 1 ? "member" : "members"}
              </span>
            </div>

            <div className="flex items-center gap-1 text-emerald-600 font-medium">
              <IndianRupee className="w-3.5 h-3.5" />
              <span className="text-sm">{formatCurrency(totalExpenses)}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
