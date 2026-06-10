'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { X, Calculator, Users, IndianRupee, Loader2, AlertCircle } from 'lucide-react';
import { useTrip } from '@/lib/trip-context';
import { createClient } from '@/lib/supabase/client';
import { splitEqual } from '@/lib/expense-calculator';
import { cn, formatCurrency, getInitials, getCategoryIcon } from '@/lib/utils';
import type { Expense } from '@/lib/types';

type EditExpenseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense;
};

type SplitType = Expense['split_type'];
type Category = Expense['category'];

const CATEGORY_OPTIONS: { value: Category; label: string; emoji: string }[] = [
  { value: 'food', label: 'Food & Drinks', emoji: '🍔' },
  { value: 'transport', label: 'Transport', emoji: '🚗' },
  { value: 'accommodation', label: 'Accommodation', emoji: '🏨' },
  { value: 'activity', label: 'Activities', emoji: '🎯' },
  { value: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { value: 'other', label: 'Other', emoji: '📦' },
];

const SPLIT_TYPE_OPTIONS: { value: SplitType; label: string }[] = [
  { value: 'EQUAL', label: 'Equal' },
  { value: 'EXACT', label: 'Exact' },
  { value: 'PERCENT', label: 'Percentage' },
];

export default function EditExpenseModal({ isOpen, onClose, expense }: EditExpenseModalProps) {
  const { trip, members, refreshExpenses } = useTrip();
  const supabase = createClient();

  // Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('food');
  const [paidBy, setPaidBy] = useState('');
  const [date, setDate] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [customPercents, setCustomPercents] = useState<Record<string, string>>({});

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form fields with current expense data
  useEffect(() => {
    if (isOpen && expense) {
      setDescription(expense.description || '');
      setAmount(expense.amount.toString() || '');
      setCategory(expense.category || 'food');
      setPaidBy(expense.paid_by || '');
      setDate(expense.date || '');
      setSplitType(expense.split_type || 'EQUAL');

      if (expense.splits && expense.splits.length > 0) {
        const originalMemberIds = expense.splits.map((s) => s.user_id);
        setSelectedMembers(originalMemberIds);

        const initialAmounts: Record<string, string> = {};
        const initialPercents: Record<string, string> = {};

        // Clear custom maps
        members.forEach((m) => {
          initialAmounts[m.user_id] = '';
          initialPercents[m.user_id] = '';
        });

        expense.splits.forEach((split) => {
          if (expense.split_type === 'EXACT') {
            initialAmounts[split.user_id] = split.amount_owed.toString();
          } else if (expense.split_type === 'PERCENT') {
            const pct = Math.round(((split.amount_owed / expense.amount) * 100) * 10) / 10;
            initialPercents[split.user_id] = pct.toString();
          }
        });

        setCustomAmounts(initialAmounts);
        setCustomPercents(initialPercents);
      } else {
        setSelectedMembers(members.map((m) => m.user_id));
      }
      setError(null);
    }
  }, [isOpen, expense, members]);

  const parsedAmount = useMemo(() => {
    const val = parseFloat(amount);
    return isNaN(val) ? 0 : val;
  }, [amount]);

  // Calculate split preview
  const splitPreview = useMemo(() => {
    if (selectedMembers.length === 0 || parsedAmount <= 0) return [];

    if (splitType === 'EQUAL') {
      return splitEqual(parsedAmount, selectedMembers).map((s) => {
        const member = members.find((m) => m.user_id === s.user_id);
        return { ...s, user: member?.user };
      });
    }

    if (splitType === 'EXACT') {
      return selectedMembers.map((userId) => {
        const member = members.find((m) => m.user_id === userId);
        const val = parseFloat(customAmounts[userId] || '0');
        return {
          user_id: userId,
          amount_owed: isNaN(val) ? 0 : val,
          user: member?.user,
        };
      });
    }

    // PERCENT
    return selectedMembers.map((userId) => {
      const member = members.find((m) => m.user_id === userId);
      const pct = parseFloat(customPercents[userId] || '0');
      const pctVal = isNaN(pct) ? 0 : pct;
      return {
        user_id: userId,
        amount_owed: Math.round(((pctVal / 100) * parsedAmount) * 100) / 100,
        percent: pctVal,
        user: member?.user,
      };
    });
  }, [splitType, parsedAmount, selectedMembers, customAmounts, customPercents, members]);

  const splitTotal = useMemo(() => {
    return splitPreview.reduce((sum, s) => sum + s.amount_owed, 0);
  }, [splitPreview]);

  const percentTotal = useMemo(() => {
    if (splitType !== 'PERCENT') return 100;
    return selectedMembers.reduce((sum, id) => {
      const val = parseFloat(customPercents[id] || '0');
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [splitType, selectedMembers, customPercents]);

  const toggleMember = useCallback((userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }, []);

  const validate = (): string | null => {
    if (!description.trim()) return 'Please enter a description.';
    if (parsedAmount <= 0) return 'Amount must be greater than zero.';
    if (selectedMembers.length === 0) return 'Select at least one member to split with.';
    if (!paidBy) return 'Select who paid.';

    if (splitType === 'EXACT') {
      const diff = Math.abs(splitTotal - parsedAmount);
      if (diff > 0.01) {
        return `Exact amounts must sum to ${formatCurrency(parsedAmount)}. Current total: ${formatCurrency(splitTotal)}`;
      }
    }

    if (splitType === 'PERCENT') {
      const diff = Math.abs(percentTotal - 100);
      if (diff > 0.01) {
        return `Percentages must sum to 100%. Current total: ${percentTotal.toFixed(1)}%`;
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!trip) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Update expense
      const { error: expenseError } = await supabase
        .from('expenses')
        .update({
          paid_by: paidBy,
          amount: parsedAmount,
          description: description.trim(),
          category,
          split_type: splitType,
          date,
        })
        .eq('id', expense.id);

      if (expenseError) throw expenseError;

      // 2. Delete old splits
      const { error: splitsDeleteError } = await supabase
        .from('expense_splits')
        .delete()
        .eq('expense_id', expense.id);

      if (splitsDeleteError) throw splitsDeleteError;

      // 3. Compute splits to insert
      let splits: { user_id: string; amount_owed: number }[];

      if (splitType === 'EQUAL') {
        splits = splitEqual(parsedAmount, selectedMembers);
      } else if (splitType === 'EXACT') {
        splits = selectedMembers.map((userId) => ({
          user_id: userId,
          amount_owed: parseFloat(customAmounts[userId] || '0'),
        }));
      } else {
        splits = selectedMembers.map((userId) => {
          const pct = parseFloat(customPercents[userId] || '0');
          return {
            user_id: userId,
            amount_owed: Math.round(((pct / 100) * parsedAmount) * 100) / 100,
          };
        });
      }

      // 4. Insert splits
      const splitsToInsert = splits.map((s) => ({
        expense_id: expense.id,
        user_id: s.user_id,
        amount_owed: s.amount_owed,
      }));

      const { error: splitsError } = await supabase
        .from('expense_splits')
        .insert(splitsToInsert);

      if (splitsError) throw splitsError;

      // 5. Refresh expenses list & close
      await refreshExpenses();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[var(--card)] border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-bold text-foreground">Edit Expense</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2.5 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </label>
            <input
              type="text"
              placeholder="e.g. Flight ticket, Dinner, Fuel"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-secondary/30 border border-border text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:border-indigo-500 transition-colors input-dark"
              required
            />
          </div>

          {/* Amount and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Amount (₹)
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-secondary/30 border border-border text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:border-indigo-500 transition-colors input-dark font-semibold"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-secondary/30 border border-border text-foreground text-sm focus:outline-none focus:border-indigo-500 transition-colors input-dark"
                required
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Category
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategory(opt.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm font-medium transition-all',
                    category === opt.value
                      ? 'bg-indigo-500/10 border-indigo-500 text-white'
                      : 'bg-secondary/20 border-border text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                  )}
                >
                  <span className="text-xl">{opt.emoji}</span>
                  <span className="text-xs">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Paid By */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Paid By
            </label>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-secondary/30 border border-border text-foreground text-sm focus:outline-none focus:border-indigo-500 transition-colors input-dark"
            >
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Split Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Split Option
            </label>
            <div className="flex gap-1.5 p-1 bg-secondary/30 rounded-xl border border-border">
              {SPLIT_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSplitType(opt.value)}
                  className={cn(
                    'flex-1 py-2 text-xs font-semibold rounded-lg text-center transition-all uppercase tracking-wider',
                    splitType === opt.value
                      ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Split Among Members */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Split With
              </label>
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                <Users className="w-3.5 h-3.5" />
                {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="border border-border/60 rounded-xl overflow-hidden divide-y divide-border/60 bg-secondary/10">
              {members.map((member) => {
                const isSelected = selectedMembers.includes(member.user_id);
                return (
                  <div
                    key={member.user_id}
                    className={cn(
                      'flex items-center justify-between p-3.5 transition-colors',
                      isSelected ? 'bg-secondary/5' : 'opacity-60'
                    )}
                  >
                    <div
                      onClick={() => toggleMember(member.user_id)}
                      className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by click on parent div
                        className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 bg-secondary/50"
                      />
                      <div className="avatar avatar-sm">
                        {getInitials(member.user.full_name)}
                      </div>
                      <span className="text-sm font-medium text-foreground truncate">
                        {member.user.full_name}
                      </span>
                    </div>

                    {/* Split input values */}
                    {isSelected && (
                      <div className="shrink-0 pl-4">
                        {splitType === 'EQUAL' && (
                          <span className="text-sm font-semibold text-foreground">
                            {formatCurrency(parsedAmount / selectedMembers.length)}
                          </span>
                        )}

                        {splitType === 'EXACT' && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">₹</span>
                            <input
                              type="number"
                              placeholder="0"
                              value={customAmounts[member.user_id] || ''}
                              onChange={(e) =>
                                setCustomAmounts((prev) => ({
                                  ...prev,
                                  [member.user_id]: e.target.value,
                                }))
                              }
                              className="w-24 px-3 py-1.5 rounded-lg bg-secondary/30 border border-border text-right text-sm text-foreground focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                            />
                          </div>
                        )}

                        {splitType === 'PERCENT' && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              placeholder="0"
                              value={customPercents[member.user_id] || ''}
                              onChange={(e) =>
                                setCustomPercents((prev) => ({
                                  ...prev,
                                  [member.user_id]: e.target.value,
                                }))
                              }
                              className="w-16 px-2.5 py-1.5 rounded-lg bg-secondary/30 border border-border text-right text-sm text-foreground focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Split Balance Info */}
            {splitType !== 'EQUAL' && parsedAmount > 0 && (
              <div className="flex justify-between items-center px-1 text-xs font-semibold">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Calculator className="w-3.5 h-3.5" />
                  Total split:
                </span>
                <span
                  className={cn(
                    Math.abs(splitType === 'EXACT' ? splitTotal - parsedAmount : percentTotal - 100) < 0.01
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  )}
                >
                  {splitType === 'EXACT'
                    ? `${formatCurrency(splitTotal)} of ${formatCurrency(parsedAmount)}`
                    : `${percentTotal.toFixed(1)}% of 100%`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-secondary/10 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-glow flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold shadow-lg transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
