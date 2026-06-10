'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { X, Calculator, Users, IndianRupee, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useTrip } from '@/lib/trip-context';
import { createClient } from '@/lib/supabase/client';
import { splitEqual } from '@/lib/expense-calculator';
import { cn, formatCurrency, getInitials, getCategoryIcon } from '@/lib/utils';
import type { Expense } from '@/lib/types';
import { notifyExpenseAdded } from '@/lib/notifications';

type AddExpenseModalProps = {
  isOpen: boolean;
  onClose: () => void;
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

export default function AddExpenseModal({ isOpen, onClose }: AddExpenseModalProps) {
  const { trip, members, currentUserId, refreshExpenses } = useTrip();
  const supabase = createClient();

  // Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('food');
  const [paidBy, setPaidBy] = useState(currentUserId ?? '');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [customPercents, setCustomPercents] = useState<Record<string, string>>({});

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with all members selected and set paidBy
  useEffect(() => {
    if (isOpen) {
      const memberIds = members.map((m) => m.user_id);
      setSelectedMembers(memberIds);
      if (currentUserId && memberIds.includes(currentUserId)) {
        setPaidBy(currentUserId);
      } else if (memberIds.length > 0) {
        setPaidBy(memberIds[0]);
      }
      // Reset custom splits
      const resetAmounts: Record<string, string> = {};
      const resetPercents: Record<string, string> = {};
      memberIds.forEach((id) => {
        resetAmounts[id] = '';
        resetPercents[id] = '';
      });
      setCustomAmounts(resetAmounts);
      setCustomPercents(resetPercents);
    }
  }, [isOpen, members, currentUserId]);

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

  const resetForm = useCallback(() => {
    setDescription('');
    setAmount('');
    setCategory('food');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setSplitType('EQUAL');
    setError(null);
    setLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

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
      // 1. Insert expense
      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          trip_id: trip.id,
          paid_by: paidBy,
          amount: parsedAmount,
          description: description.trim(),
          category,
          split_type: splitType,
          date,
        })
        .select('id')
        .single();

      if (expenseError) throw expenseError;
      if (!expenseData) throw new Error('Failed to create expense.');

      // 2. Calculate splits
      let splits: { user_id: string; amount_owed: number }[];

      if (splitType === 'EQUAL') {
        splits = splitEqual(parsedAmount, selectedMembers);
      } else if (splitType === 'EXACT') {
        splits = selectedMembers.map((userId) => ({
          user_id: userId,
          amount_owed: parseFloat(customAmounts[userId] || '0'),
        }));
      } else {
        // PERCENT
        splits = selectedMembers.map((userId) => {
          const pct = parseFloat(customPercents[userId] || '0');
          return {
            user_id: userId,
            amount_owed: Math.round(((pct / 100) * parsedAmount) * 100) / 100,
          };
        });
      }

      // 3. Insert splits
      const splitsToInsert = splits.map((s) => ({
        expense_id: expenseData.id,
        user_id: s.user_id,
        amount_owed: s.amount_owed,
      }));

      const { error: splitsError } = await supabase
        .from('expense_splits')
        .insert(splitsToInsert);

      if (splitsError) throw splitsError;

      // 4. Refresh & close
      await refreshExpenses();

      // Send notifications
      try {
        const payerMember = members.find((m) => m.user_id === paidBy);
        await notifyExpenseAdded(
          trip.id,
          payerMember?.user?.full_name ?? 'Someone',
          parsedAmount,
          description.trim(),
          members.map((m) => m.user_id),
          paidBy
        );
      } catch (notifErr) {
        console.error('Failed to send notifications:', notifErr);
      }

      handleClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Add Expense</h2>
              <p className="text-xs text-muted-foreground">Track a new expense</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-5 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="space-y-5">
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              Description
            </label>
            <input
              type="text"
              placeholder="e.g., Dinner at Barbeque Nation"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-dark"
            />
          </div>

          {/* Amount + Category Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Amount
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-muted-foreground">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input-dark pl-9"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="input-dark appearance-none cursor-pointer"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.emoji} {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Paid By + Date Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Paid by
              </label>
              <select
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                className="input-dark appearance-none cursor-pointer"
              >
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-dark"
              />
            </div>
          </div>

          {/* Split Type */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Split Type
            </label>
            <div className="flex gap-1.5 p-1 bg-secondary rounded-xl">
              {SPLIT_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSplitType(opt.value)}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-300',
                    splitType === opt.value
                      ? 'bg-indigo-500/20 text-indigo-300 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Split Among */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <label className="text-sm font-medium text-muted-foreground">
                Split among
              </label>
              <button
                onClick={() => {
                  const allIds = members.map((m) => m.user_id);
                  setSelectedMembers((prev) =>
                    prev.length === allIds.length ? [] : allIds
                  );
                }}
                className="ml-auto text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {selectedMembers.length === members.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {members.map((m) => {
                const isSelected = selectedMembers.includes(m.user_id);
                return (
                  <div
                    key={m.user_id}
                    className={cn(
                      'flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 cursor-pointer',
                      isSelected
                        ? 'bg-indigo-500/10 border border-indigo-500/20'
                        : 'bg-secondary/50 border border-transparent hover:bg-accent/50'
                    )}
                    onClick={() => toggleMember(m.user_id)}
                  >
                    {/* Checkbox */}
                    <div
                      className={cn(
                        'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 shrink-0',
                        isSelected
                          ? 'bg-indigo-500 border-indigo-500'
                          : 'border-border'
                      )}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    {/* Avatar */}
                    {m.user.avatar_url ? (
                      <img
                        src={m.user.avatar_url}
                        alt={m.user.full_name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="avatar avatar-sm">
                        {getInitials(m.user.full_name)}
                      </div>
                    )}

                    <span className="flex-1 text-sm font-medium text-foreground truncate">
                      {m.user.full_name}
                      {m.user_id === currentUserId && (
                        <span className="text-xs text-muted-foreground ml-1">(You)</span>
                      )}
                    </span>

                    {/* Custom amount/percent input */}
                    {isSelected && splitType === 'EXACT' && (
                      <div className="relative w-24" onClick={(e) => e.stopPropagation()}>
                        <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          value={customAmounts[m.user_id] ?? ''}
                          onChange={(e) =>
                            setCustomAmounts((prev) => ({
                              ...prev,
                              [m.user_id]: e.target.value,
                            }))
                          }
                          className="input-dark text-xs py-1.5 pl-7 pr-2 text-right"
                        />
                      </div>
                    )}
                    {isSelected && splitType === 'PERCENT' && (
                      <div className="relative w-20" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="0"
                          value={customPercents[m.user_id] ?? ''}
                          onChange={(e) =>
                            setCustomPercents((prev) => ({
                              ...prev,
                              [m.user_id]: e.target.value,
                            }))
                          }
                          className="input-dark text-xs py-1.5 px-2 text-right"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          %
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Validation indicator for EXACT / PERCENT */}
          {splitType === 'EXACT' && parsedAmount > 0 && selectedMembers.length > 0 && (
            <div
              className={cn(
                'flex items-center justify-between text-sm px-3 py-2 rounded-xl',
                Math.abs(splitTotal - parsedAmount) <= 0.01
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              )}
            >
              <span>Split total: {formatCurrency(splitTotal)}</span>
              <span>
                {Math.abs(splitTotal - parsedAmount) <= 0.01
                  ? '✓ Balanced'
                  : `Remaining: ${formatCurrency(parsedAmount - splitTotal)}`}
              </span>
            </div>
          )}

          {splitType === 'PERCENT' && parsedAmount > 0 && selectedMembers.length > 0 && (
            <div
              className={cn(
                'flex items-center justify-between text-sm px-3 py-2 rounded-xl',
                Math.abs(percentTotal - 100) <= 0.01
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              )}
            >
              <span>Total: {percentTotal.toFixed(1)}%</span>
              <span>
                {Math.abs(percentTotal - 100) <= 0.01
                  ? '✓ Balanced'
                  : `Remaining: ${(100 - percentTotal).toFixed(1)}%`}
              </span>
            </div>
          )}

          {/* Split Preview */}
          {parsedAmount > 0 && splitPreview.length > 0 && (
            <div className="bg-secondary/50 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Split Preview
              </p>
              {splitPreview.map((s) => (
                <div
                  key={s.user_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-foreground/80">
                    {s.user?.full_name ?? 'Unknown'}
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(s.amount_owed)}
                  </span>
                </div>
              ))}
              <div className="h-px bg-border my-1.5" />
              <div className="flex items-center justify-between text-sm font-bold">
                <span className="text-muted-foreground">Total</span>
                <span className="text-foreground">{formatCurrency(splitTotal)}</span>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={cn(
              'btn-glow w-full flex items-center justify-center gap-2 py-3',
              loading && 'opacity-60 cursor-not-allowed'
            )}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <IndianRupee className="w-4 h-4" />
                Add Expense · {parsedAmount > 0 ? formatCurrency(parsedAmount) : '₹0'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
