'use client';

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Wallet, CheckCircle, DollarSign } from 'lucide-react';
import { useTrip } from '@/lib/trip-context';
import { calculateBalances, getTotalExpenses } from '@/lib/expense-calculator';
import { cn, formatCurrency, getInitials } from '@/lib/utils';

export default function BalanceSummary() {
  const { expenses, settlements, members, currentUserId } = useTrip();

  const memberUsers = useMemo(
    () => members.map((m) => m.user),
    [members]
  );

  const balances = useMemo(
    () => calculateBalances(expenses, settlements, memberUsers),
    [expenses, settlements, memberUsers]
  );

  const totalSpent = useMemo(() => getTotalExpenses(expenses), [expenses]);

  const myBalance = useMemo(
    () => balances.find((b) => b.userId === currentUserId),
    [balances, currentUserId]
  );

  const settledCount = settlements.length;

  // Max absolute balance for proportional bars
  const maxAbsBalance = useMemo(() => {
    if (balances.length === 0) return 1;
    return Math.max(...balances.map((b) => Math.abs(b.netBalance)), 1);
  }, [balances]);

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Total Spent */}
        <div className="glass-card p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-2.5">
            <Wallet className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-xs text-muted-foreground font-medium">Total Spent</p>
          <p className="text-lg font-bold text-foreground mt-0.5">
            {formatCurrency(totalSpent)}
          </p>
        </div>

        {/* Your Balance */}
        <div className="glass-card p-4 text-center">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2.5',
              myBalance && myBalance.netBalance >= 0
                ? 'bg-emerald-500/10'
                : 'bg-red-500/10'
            )}
          >
            {myBalance && myBalance.netBalance >= 0 ? (
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )}
          </div>
          <p className="text-xs text-muted-foreground font-medium">Your Balance</p>
          <p
            className={cn(
              'text-lg font-bold mt-0.5',
              myBalance && myBalance.netBalance >= 0
                ? 'text-emerald-600'
                : 'text-red-600'
            )}
          >
            {myBalance ? formatCurrency(Math.abs(myBalance.netBalance)) : '₹0'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {myBalance && myBalance.netBalance >= 0 ? 'you get back' : 'you owe'}
          </p>
        </div>

        {/* Settlements Done */}
        <div className="glass-card p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-2.5">
            <CheckCircle className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-xs text-muted-foreground font-medium">Settlements</p>
          <p className="text-lg font-bold text-foreground mt-0.5">{settledCount}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">completed</p>
        </div>
      </div>

      {/* Balances List */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Member Balances
          </h4>
        </div>

        {balances.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground text-sm">No balance data yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {balances.map((entry, index) => {
              const isCurrentUser = entry.userId === currentUserId;
              const isPositive = entry.netBalance >= 0;

              return (
                <div
                  key={entry.userId}
                  className={cn(
                    'glass-card p-4 animate-fade-in opacity-0',
                    isCurrentUser && 'ring-1 ring-primary/20'
                  )}
                  style={{
                    animationDelay: `${index * 0.07}s`,
                    animationFillMode: 'forwards',
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative">
                      {entry.user.avatar_url ? (
                        <img
                          src={entry.user.avatar_url}
                          alt={entry.user.full_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="avatar avatar-md">
                          {getInitials(entry.user.full_name)}
                        </div>
                      )}
                      {isCurrentUser && (
                        <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-card" />
                      )}
                    </div>

                    {/* Name + Stats */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground truncate">
                          {entry.user.full_name}
                        </p>
                        {isCurrentUser && (
                          <span className="badge badge-info text-[10px] py-0.5 px-1.5">You</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>Paid: {formatCurrency(entry.totalPaid)}</span>
                        <span>·</span>
                        <span>Owes: {formatCurrency(entry.totalOwed)}</span>
                      </div>
                    </div>

                    {/* Net Balance */}
                    <div className="text-right shrink-0">
                      <div
                        className={cn(
                          'flex items-center gap-1 justify-end',
                          isPositive ? 'text-emerald-600' : 'text-red-600'
                        )}
                      >
                        {isPositive ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" />
                        )}
                        <span className="text-lg font-bold">
                          {formatCurrency(Math.abs(entry.netBalance))}
                        </span>
                      </div>
                      <p
                        className={cn(
                          'text-[10px] font-medium',
                          isPositive ? 'text-emerald-600/80' : 'text-red-600/80'
                        )}
                      >
                        {isPositive ? 'gets back' : 'owes'}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700 ease-out',
                          isPositive
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                            : 'bg-gradient-to-r from-red-500 to-red-400'
                        )}
                        style={{
                          width: `${Math.min(
                            (Math.abs(entry.netBalance) / maxAbsBalance) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
