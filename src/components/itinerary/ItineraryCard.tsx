"use client";

import { useState } from "react";
import {
  Train,
  Compass,
  UtensilsCrossed,
  Hotel,
  Camera,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/utils";
import type { ItineraryItem } from "@/lib/types";

type ItineraryCardProps = {
  item: ItineraryItem;
  onEdit?: (item: ItineraryItem) => void;
  onDelete?: (item: ItineraryItem) => void;
  canModify?: boolean;
};

const categoryIcons: Record<ItineraryItem["category"], React.ElementType> = {
  transport: Train,
  activity: Compass,
  meal: UtensilsCrossed,
  accommodation: Hotel,
  sightseeing: Camera,
};

function formatTime(time: string | null): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

export default function ItineraryCard({
  item,
  onEdit,
  onDelete,
  canModify = false,
}: ItineraryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = categoryIcons[item.category];
  const colorClasses = getCategoryColor(item.category);

  const hasDescription = item.description && item.description.trim().length > 0;
  const isLongDescription =
    hasDescription && (item.description as string).length > 100;

  return (
    <div
      className={cn(
        "group relative glass-card p-4 transition-all duration-300",
        "hover:translate-y-[-2px] hover:shadow-lg hover:shadow-blue-500/5"
      )}
    >
      {/* Edit/Delete Actions */}
      {canModify && (
        <div className="absolute right-3 top-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={() => onEdit?.(item)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            title="Edit activity"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete?.(item)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 hover:bg-red-500/20 transition-all"
            title="Delete activity"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Category Icon */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            colorClasses
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Time Range */}
          {(item.start_time || item.end_time) && (
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {formatTime(item.start_time)}
                {item.start_time && item.end_time && " — "}
                {formatTime(item.end_time)}
              </span>
            </div>
          )}

          {/* Title */}
          <h4 className="font-semibold text-foreground leading-tight">
            {item.title}
          </h4>

          {/* Location */}
          {item.location && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{item.location}</span>
            </div>
          )}

          {/* Description */}
          {hasDescription && (
            <div className="mt-2">
              <p
                className={cn(
                  "text-sm text-muted-foreground leading-relaxed",
                  !expanded && isLongDescription && "line-clamp-2"
                )}
              >
                {item.description}
              </p>
              {isLongDescription && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-1 flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  {expanded ? (
                    <>
                      Show less <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      Show more <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Category Badge */}
        <span
          className={cn(
            "badge shrink-0 text-[10px] capitalize group-hover:opacity-0 transition-opacity",
            colorClasses
          )}
        >
          {item.category}
        </span>
      </div>
    </div>
  );
}
