'use client';

import { useState, useMemo } from 'react';
import { Receipt, Scale, Handshake, IndianRupee } from 'lucide-react';
import { useTrip } from '@/lib/trip-context';
import { calculateBalances, getTotalExpenses } from '@/lib/expense-calculator';
import { cn, formatCurrency } from '@/lib/utils';
import ExpenseList from './ExpenseList';
import BalanceSummary from './BalanceSummary';
import SettlementView from './SettlementView';

type SubTab = 'expenses' | 'balances' | 'settle';

const SUB_TABS: { id: SubTab; label: string; icon: typeof Receipt }[] = [
  { id: 'expenses', label: 'All Expenses', icon: Receipt },
  { id: 'balances', label: 'Balances', icon: Scale },
  { id: 'settle', label: 'Settle Up', icon: Handshake },
];

export default function ExpenseTab() {
  const [activeTab, setActiveTab] = useState<SubTab>('expenses');
  const { expenses, settlements, members, currentUserId } = useTrip();

  const totalSpent = useMemo(() => getTotalExpenses(expenses), [expenses]);

  const memberUsers = useMemo(() => members.map((m) => m.user), [members]);

  const myShare = useMemo(() => {
    const balances = calculateBalances(expenses, settlements, memberUsers);
    const mine = balances.find((b) => b.userId === currentUserId);
    return mine?.totalOwed ?? 0;
  }, [expenses, settlements, memberUsers, currentUserId]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Quick Stats Bar */}
      <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-secondary/50 border border-border/50">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <IndianRupee className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              Total
            </p>
            <p className="text-sm font-bold text-foreground">{formatCurrency(totalSpent)}</p>
          </div>
        </div>

        <div className="w-px h-8 bg-border" />

        <div className="flex items-center gap-2 flex-1">
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              myShare > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'
            )}
          >
            <Receipt
              className={cn(
                'w-4 h-4',
                myShare > 0 ? 'text-amber-600' : 'text-emerald-600'
              )}
            />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              Your share
            </p>
            <p className="text-sm font-bold text-foreground">{formatCurrency(myShare)}</p>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex gap-1.5 p-1 bg-secondary/50 rounded-xl border border-border/30">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 flex-1 justify-center py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-300',
                isActive
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-slate-100'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ').pop()}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in" key={activeTab}>
        {activeTab === 'expenses' && <ExpenseList />}
        {activeTab === 'balances' && <BalanceSummary />}
        {activeTab === 'settle' && <SettlementView />}
      </div>
    </div>
  );
}
