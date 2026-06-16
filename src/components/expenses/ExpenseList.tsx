'use client';

import { useState, useMemo } from 'react';
import { Plus, Filter, Receipt, Search, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTrip } from '@/lib/trip-context';
import { cn, formatCurrency, getCategoryIcon, getCategoryColor, getInitials } from '@/lib/utils';
import { getTotalExpenses } from '@/lib/expense-calculator';
import { createClient } from '@/lib/supabase/client';
import type { Expense } from '@/lib/types';
import AddExpenseModal from './AddExpenseModal';
import EditExpenseModal from './EditExpenseModal';

const CATEGORIES = [
  { value: 'all', label: 'All', emoji: '📊' },
  { value: 'food', label: 'Food', emoji: '🍔' },
  { value: 'transport', label: 'Transport', emoji: '🚗' },
  { value: 'accommodation', label: 'Stay', emoji: '🏨' },
  { value: 'activity', label: 'Activity', emoji: '🎯' },
  { value: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { value: 'other', label: 'Other', emoji: '📦' },
] as const;

type CategoryFilter = typeof CATEGORIES[number]['value'];

function groupExpensesByDate(expenses: Expense[]): Map<string, Expense[]> {
  const groups = new Map<string, Expense[]>();
  expenses.forEach((expense) => {
    const dateKey = expense.date;
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(expense);
    } else {
      groups.set(dateKey, [expense]);
    }
  });
  return groups;
}

function getSplitTypeBadge(splitType: Expense['split_type']) {
  switch (splitType) {
    case 'EQUAL':
      return { label: 'Equal', className: 'badge badge-info' };
    case 'EXACT':
      return { label: 'Exact', className: 'badge badge-warning' };
    case 'PERCENT':
      return { label: '%', className: 'badge badge-success' };
  }
}

export default function ExpenseList() {
  const { expenses, refreshExpenses, currentUserId, isAdmin, members } = useTrip();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [togglingSplitId, setTogglingSplitId] = useState<string | null>(null);

  const handleToggleSplitPaid = async (
    expense: Expense,
    splitId: string,
    currentStatus: boolean,
    splitUserId: string,
    splitAmount: number
  ) => {
    setTogglingSplitId(splitId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('expense_splits')
        .update({ is_paid: !currentStatus })
        .eq('id', splitId);

      if (error) throw error;

      // Send notifications to everyone else on the trip
      try {
        const triggerUser = members.find((m) => m.user_id === currentUserId)?.user;
        const triggerName = triggerUser?.full_name ?? 'Someone';
        const targetUser = members.find((m) => m.user_id === splitUserId)?.user;
        const targetName = targetUser?.full_name ?? 'Someone';

        // Notify all trip members except the trigger user
        const notifyList = members
          .map((m) => m.user_id)
          .filter((id) => id !== currentUserId);

        if (notifyList.length > 0) {
          const statusText = !currentStatus ? 'paid' : 'unpaid';
          const inserts = notifyList.map((userId) => ({
            user_id: userId,
            trip_id: expense.trip_id,
            type: 'settlement' as const,
            title: !currentStatus ? 'Payment Marked Paid' : 'Payment Marked Pending',
            message: currentUserId === splitUserId
              ? `${triggerName} marked their split of "${expense.description}" (${formatCurrency(splitAmount)}) as ${statusText}`
              : `${triggerName} marked ${targetName}'s split of "${expense.description}" (${formatCurrency(splitAmount)}) as ${statusText}`,
          }));

          await supabase.from('notifications').insert(inserts);
        }
      } catch (notifErr) {
        console.error('Error sending split payment notification:', notifErr);
      }

      await refreshExpenses();
    } catch (err) {
      console.error('Error toggling split status:', err);
      alert('Failed to update split payment status. Please run the SQL schema migration if you haven\'t already.');
    } finally {
      setTogglingSplitId(null);
    }
  };

  const handleDelete = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    setDeletingId(expenseId);
    try {
      const supabase = createClient();
      await supabase.from('expense_splits').delete().eq('expense_id', expenseId);
      const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
      if (error) throw error;
      await refreshExpenses();
    } catch (err) {
      console.error('Error deleting expense:', err);
    } finally {
      setDeletingId(null);
      setMenuOpenId(null);
    }
  };

  const totalAmount = useMemo(() => getTotalExpenses(expenses), [expenses]);

  const filteredExpenses = useMemo(() => {
    let filtered = expenses;

    if (activeCategory !== 'all') {
      filtered = filtered.filter((e) => e.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          e.paid_by_user?.full_name.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [expenses, activeCategory, searchQuery]);

  const groupedExpenses = useMemo(
    () => groupExpensesByDate(filteredExpenses),
    [filteredExpenses]
  );

  const filteredTotal = useMemo(
    () => getTotalExpenses(filteredExpenses),
    [filteredExpenses]
  );

  let globalIndex = 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">Expenses</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Total: <span className="font-semibold text-foreground">{formatCurrency(totalAmount)}</span>
            {activeCategory !== 'all' && (
              <span className="ml-2">
                · Filtered: <span className="font-semibold text-blue-600">{formatCurrency(filteredTotal)}</span>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={cn(
              'p-2.5 rounded-xl transition-all duration-300',
              showSearch
                ? 'bg-primary/15 text-primary'
                : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-glow flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Expense</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="animate-fade-in">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-dark !pl-10"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 shrink-0',
              activeCategory === cat.value
                ? 'bg-primary/10 text-primary ring-1 ring-primary/25'
                : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <span className="text-base">{cat.emoji}</span>
            {cat.label}
            {cat.value !== 'all' && (
              <span className="text-xs opacity-60">
                {expenses.filter((e) => e.category === cat.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Expense List */}
      {filteredExpenses.length === 0 ? (
        <div className="glass-card p-10 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-8 h-8 text-primary" />
          </div>
          <h4 className="text-foreground font-semibold text-lg mb-1">
            {expenses.length === 0 ? 'No expenses yet' : 'No matching expenses'}
          </h4>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            {expenses.length === 0
              ? 'Start tracking your trip expenses by adding your first one!'
              : 'Try adjusting your filters or search query.'}
          </p>
          {expenses.length === 0 && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-glow mt-5 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add First Expense
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedExpenses.entries()).map(([dateKey, dateExpenses]) => (
            <div key={dateKey} className="space-y-2.5">
              {/* Date Header */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-muted-foreground">
                  {format(parseISO(dateKey), 'EEE, MMM d, yyyy')}
                </span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-medium text-muted-foreground">
                  {formatCurrency(dateExpenses.reduce((sum, e) => sum + e.amount, 0))}
                </span>
              </div>

              {/* Expense Items */}
              {dateExpenses.map((expense) => {
                const currentIndex = globalIndex++;
                const splitBadge = getSplitTypeBadge(expense.split_type);
                const paidByUser = expense.paid_by_user;

                return (
                  <div
                    key={expense.id}
                    className="glass-card p-4 animate-fade-in opacity-0 cursor-pointer hover:bg-slate-50/30 transition-all duration-300 select-none"
                    onClick={() => setExpandedId(expandedId === expense.id ? null : expense.id)}
                    style={{
                      animationDelay: `${Math.min(currentIndex * 0.06, 0.6)}s`,
                      animationFillMode: 'forwards',
                    }}
                  >
                    <div className="flex items-center gap-3.5">
                      {/* Category Icon */}
                      <div
                        className={cn(
                          'w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0',
                          getCategoryColor(expense.category)
                        )}
                      >
                        {getCategoryIcon(expense.category)}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground truncate">
                            {expense.description}
                          </h4>
                          <span className={splitBadge.className}>
                            {splitBadge.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {/* Paid by */}
                          <div className="flex items-center gap-1.5">
                            {paidByUser?.avatar_url ? (
                              <img
                                src={paidByUser.avatar_url}
                                alt={paidByUser.full_name}
                                className="w-5 h-5 rounded-full object-cover"
                              />
                            ) : (
                              <div className="avatar avatar-sm w-5 h-5 text-[9px]">
                                {getInitials(paidByUser?.full_name ?? '?')}
                              </div>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {paidByUser?.full_name ?? 'Unknown'}
                            </span>
                          </div>
                          <span className="text-muted-foreground/40 text-xs">•</span>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(expense.date), 'd MMM')}
                          </span>
                        </div>
                      </div>

                      {/* Amount & Actions */}
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <div className="text-right">
                          <p className="text-lg font-bold text-foreground">
                            {formatCurrency(expense.amount)}
                          </p>
                          {expense.splits && (
                            <p className="text-xs text-muted-foreground">
                              {expense.splits.length} split{expense.splits.length !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>

                        {/* Actions kebab menu */}
                        {(currentUserId === expense.paid_by || isAdmin) && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(menuOpenId === expense.id ? null : expense.id);
                              }}
                              className="p-1 rounded-lg hover:bg-slate-100 text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="Expense actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {menuOpenId === expense.id && (
                              <>
                                <div 
                                  className="fixed inset-0 z-30" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenId(null);
                                  }}
                                />
                                <div className="absolute right-0 mt-1 w-28 rounded-xl bg-[var(--card)] border border-border shadow-xl py-1 z-40 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingExpense(expense);
                                      setMenuOpenId(null);
                                    }}
                                    className="flex items-center gap-2 w-full px-3.5 py-2 text-xs font-medium text-foreground hover:bg-slate-100 transition-colors text-left"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(expense.id);
                                    }}
                                    disabled={deletingId === expense.id}
                                    className="flex items-center gap-2 w-full px-3.5 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors text-left disabled:opacity-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    {deletingId === expense.id ? 'Deleting...' : 'Delete'}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Split Breakdown Detail Drawer */}
                    {expandedId === expense.id && expense.splits && expense.splits.length > 0 && (
                      <div 
                        className="mt-4 pt-4 border-t border-border/60 space-y-3 animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          <span>Split Breakdown</span>
                          <span>Payment Status</span>
                        </div>
                        <div className="divide-y divide-border/30">
                          {expense.splits.map((split) => {
                            const isPaid = split.is_paid;
                            const canToggle = isAdmin || currentUserId === expense.paid_by || currentUserId === split.user_id;
                            const splitUser = split.user;
                            const isPayer = split.user_id === expense.paid_by;

                            return (
                              <div key={split.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                                <div className="flex items-center gap-2.5">
                                  {splitUser?.avatar_url ? (
                                    <img
                                      src={splitUser.avatar_url}
                                      alt={splitUser.full_name}
                                      className="w-7 h-7 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="avatar avatar-sm w-7 h-7 text-[10px]">
                                      {getInitials(splitUser?.full_name ?? '?')}
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-xs font-semibold text-foreground">
                                      {splitUser?.full_name ?? 'Unknown'}
                                      {split.user_id === currentUserId && <span className="text-[10px] text-primary ml-1">(You)</span>}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      Owes {formatCurrency(split.amount_owed)}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {isPayer ? (
                                    <span className="badge badge-success text-[10px] py-0.5 px-2">Payer (Paid)</span>
                                  ) : (
                                    <>
                                      <span className={cn(
                                        "badge text-[10px] py-0.5 px-2",
                                        isPaid ? "badge-success" : "bg-amber-500/10 text-amber-600"
                                      )}>
                                        {isPaid ? "Paid" : "Pending"}
                                      </span>
                                      {canToggle && (
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            await handleToggleSplitPaid(expense, split.id, !!isPaid, split.user_id, split.amount_owed);
                                          }}
                                          disabled={togglingSplitId === split.id}
                                          className={cn(
                                            "text-[10px] font-bold px-2 py-1 rounded-lg transition-all cursor-pointer",
                                            isPaid
                                              ? "bg-slate-100 text-muted-foreground hover:bg-slate-200/85"
                                              : "bg-primary/10 text-primary hover:bg-primary/20 hover:scale-[1.02]"
                                          )}
                                        >
                                          {togglingSplitId === split.id ? "..." : isPaid ? "Mark Unpaid" : "Mark Paid"}
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Summary Footer */}
      {filteredExpenses.length > 0 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Showing {filteredExpenses.length} of {expenses.length} expenses
          </span>
        </div>
      )}

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Edit Expense Modal */}
      {editingExpense && (
        <EditExpenseModal
          isOpen={!!editingExpense}
          onClose={() => setEditingExpense(null)}
          expense={editingExpense}
        />
      )}
    </div>
  );
}
