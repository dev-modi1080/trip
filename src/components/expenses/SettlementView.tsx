'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  ArrowRight,
  CheckCircle,
  Banknote,
  PartyPopper,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTrip } from '@/lib/trip-context';
import { calculateBalances, simplifyDebts } from '@/lib/expense-calculator';
import { createClient } from '@/lib/supabase/client';
import { cn, formatCurrency, getInitials } from '@/lib/utils';
import { notifySettlement } from '@/lib/notifications';

export default function SettlementView() {
  const { trip, expenses, settlements, members, refreshSettlements, currentUserId } =
    useTrip();
  const supabase = createClient();

  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const memberUsers = useMemo(() => members.map((m) => m.user), [members]);

  const balances = useMemo(
    () => calculateBalances(expenses, settlements, memberUsers),
    [expenses, settlements, memberUsers]
  );

  const debts = useMemo(() => simplifyDebts(balances), [balances]);

  const allSettled = debts.length === 0 && expenses.length > 0;

  const handleSettle = useCallback(
    async (fromUserId: string, toUserId: string, amount: number) => {
      if (!trip) return;

      const debtKey = `${fromUserId}-${toUserId}`;
      setSettlingId(debtKey);
      setError(null);

      try {
        const { error: insertError } = await supabase
          .from('settlements')
          .insert({
            trip_id: trip.id,
            from_user: fromUserId,
            to_user: toUserId,
            amount,
          });

        if (insertError) throw insertError;

        await refreshSettlements();

        // Send notification
        try {
          const fromMember = members.find((m) => m.user_id === fromUserId);
          await notifySettlement(
            trip.id,
            fromMember?.user?.full_name ?? 'Someone',
            toUserId,
            amount
          );
        } catch (notifErr) {
          console.error('Failed to send settlement notification:', notifErr);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to record settlement.';
        setError(message);
      } finally {
        setSettlingId(null);
      }
    },
    [trip, supabase, refreshSettlements, members]
  );

  return (
    <div className="space-y-6">
      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* All Settled Celebration */}
      {allSettled && (
        <div className="glass-card p-8 text-center animate-scale-in relative overflow-hidden">
          {/* Confetti-like particles */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full animate-bounce"
                style={{
                  left: `${8 + (i * 7.5) % 85}%`,
                  top: `${10 + ((i * 13) % 60)}%`,
                  backgroundColor: [
                    '#6366f1',
                    '#10b981',
                    '#f59e0b',
                    '#ec4899',
                    '#8b5cf6',
                    '#06b6d4',
                  ][i % 6],
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: `${1.5 + (i % 3) * 0.5}s`,
                  opacity: 0.6,
                }}
              />
            ))}
          </div>

          <div className="relative z-10">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <PartyPopper className="w-10 h-10 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold gradient-text mb-2">All Settled Up! 🎉</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Everyone is square. No outstanding balances remaining. Time to plan the next
              trip!
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span className="text-sm text-amber-600 font-semibold">
                {settlements.length} settlement{settlements.length !== 1 ? 's' : ''} completed
              </span>
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
          </div>
        </div>
      )}

      {/* Pending Debts */}
      {debts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Banknote className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Settle Up ({debts.length} transaction{debts.length !== 1 ? 's' : ''})
            </h4>
          </div>

          <div className="space-y-3">
            {debts.map((debt, index) => {
              const debtKey = `${debt.from.id}-${debt.to.id}`;
              const isSettling = settlingId === debtKey;

              return (
                <div
                  key={debtKey}
                  className="glass-card p-5 animate-fade-in opacity-0"
                  style={{
                    animationDelay: `${index * 0.08}s`,
                    animationFillMode: 'forwards',
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* FROM User (Red - owes money) */}
                    <div className="flex flex-col items-center gap-1.5 min-w-0">
                      <div className="relative">
                        {debt.from.avatar_url ? (
                          <img
                            src={debt.from.avatar_url}
                            alt={debt.from.full_name}
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-red-500/30"
                          />
                        ) : (
                          <div className="avatar avatar-lg ring-2 ring-red-500/30">
                            {getInitials(debt.from.full_name)}
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                          <ArrowRight className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-red-600 truncate max-w-[80px]">
                        {debt.from.full_name}
                        {debt.from.id === currentUserId && (
                          <span className="text-muted-foreground font-normal"> (You)</span>
                        )}
                      </p>
                    </div>

                    {/* Arrow + Amount */}
                    <div className="flex-1 flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2 w-full">
                        <div className="flex-1 h-px bg-gradient-to-r from-red-500/50 to-transparent" />
                        <div className="bg-secondary px-3 py-1.5 rounded-full">
                          <p className="text-base font-bold text-foreground">
                            {formatCurrency(debt.amount)}
                          </p>
                        </div>
                        <div className="flex-1 h-px bg-gradient-to-l from-emerald-500/50 to-transparent" />
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>

                    {/* TO User (Green - receives money) */}
                    <div className="flex flex-col items-center gap-1.5 min-w-0">
                      <div className="relative">
                        {debt.to.avatar_url ? (
                          <img
                            src={debt.to.avatar_url}
                            alt={debt.to.full_name}
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/30"
                          />
                        ) : (
                          <div className="avatar avatar-lg ring-2 ring-emerald-500/30">
                            {getInitials(debt.to.full_name)}
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                          <CheckCircle className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-emerald-600 truncate max-w-[80px]">
                        {debt.to.full_name}
                        {debt.to.id === currentUserId && (
                          <span className="text-muted-foreground font-normal"> (You)</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Settle Button */}
                  <button
                    onClick={() => handleSettle(debt.from.id, debt.to.id, debt.amount)}
                    disabled={isSettling}
                    className={cn(
                      'w-full mt-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2',
                      isSettling
                        ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                        : 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30'
                    )}
                  >
                    {isSettling ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Recording...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Settle Up
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No expenses fallback */}
      {expenses.length === 0 && (
        <div className="glass-card p-8 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Banknote className="w-8 h-8 text-primary" />
          </div>
          <h4 className="text-foreground font-semibold text-lg mb-1">No expenses yet</h4>
          <p className="text-muted-foreground text-sm">
            Add expenses first to see who owes whom.
          </p>
        </div>
      )}

      {/* Settlement History */}
      {settlements.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Settlement History
            </h4>
          </div>

          <div className="space-y-2">
            {settlements.map((settlement, index) => (
              <div
                key={settlement.id}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-secondary/50 border border-border/50 animate-fade-in opacity-0"
                style={{
                  animationDelay: `${index * 0.05}s`,
                  animationFillMode: 'forwards',
                }}
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold text-red-600">
                      {settlement.from_user_details?.full_name ?? 'Unknown'}
                    </span>
                    <span className="text-muted-foreground mx-1.5">paid</span>
                    <span className="font-semibold text-emerald-600">
                      {settlement.to_user_details?.full_name ?? 'Unknown'}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(parseISO(settlement.settled_at), 'MMM d, yyyy · h:mm a')}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-bold text-foreground">
                    {formatCurrency(settlement.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
