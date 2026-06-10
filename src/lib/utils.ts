import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    food: "🍔",
    transport: "🚗",
    accommodation: "🏨",
    activity: "🎯",
    shopping: "🛍️",
    sightseeing: "📸",
    meal: "🍽️",
    other: "📦",
  };
  return icons[category] || "📦";
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    food: "bg-orange-500/10 text-orange-600",
    transport: "bg-blue-500/10 text-blue-600",
    accommodation: "bg-purple-500/10 text-purple-600",
    activity: "bg-emerald-500/10 text-emerald-600",
    shopping: "bg-pink-500/10 text-pink-600",
    sightseeing: "bg-amber-500/10 text-amber-600",
    meal: "bg-red-500/10 text-red-600",
    other: "bg-slate-500/10 text-slate-600",
  };
  return colors[category] || "bg-slate-500/10 text-slate-600";
}
