import type {
  Expense,
  ExpenseSplit,
  Settlement,
  User,
  BalanceEntry,
  SimplifiedDebt,
} from "@/lib/types";

/**
 * Calculate the net balance for each user in a trip.
 * Positive = gets money back, Negative = owes money.
 */
export function calculateBalances(
  expenses: Expense[],
  settlements: Settlement[],
  members: User[]
): BalanceEntry[] {
  const balanceMap = new Map<string, { totalPaid: number; totalOwed: number }>();

  // Initialize all members
  members.forEach((m) => {
    balanceMap.set(m.id, { totalPaid: 0, totalOwed: 0 });
  });

  // Process expenses
  expenses.forEach((expense) => {
    const payer = balanceMap.get(expense.paid_by);
    if (payer) {
      payer.totalPaid += expense.amount;
    }

    if (expense.splits) {
      expense.splits.forEach((split) => {
        const member = balanceMap.get(split.user_id);
        if (member) {
          member.totalOwed += split.amount_owed;

          // If the split has been marked as paid (and it's not the payer themselves)
          if (split.is_paid && split.user_id !== expense.paid_by) {
            member.totalPaid += split.amount_owed;
            if (payer) {
              payer.totalOwed += split.amount_owed;
            }
          }
        }
      });
    }
  });

  // Process settlements (settled debts reduce the net balance)
  settlements.forEach((s) => {
    const fromUser = balanceMap.get(s.from_user);
    const toUser = balanceMap.get(s.to_user);
    if (fromUser) {
      fromUser.totalPaid += s.amount; // paying a settlement is like paying
    }
    if (toUser) {
      toUser.totalOwed += s.amount; // receiving a settlement is like owing (settled)
    }
  });

  const entries: BalanceEntry[] = [];
  balanceMap.forEach((val, userId) => {
    const user = members.find((m) => m.id === userId);
    if (user) {
      entries.push({
        userId,
        user,
        totalPaid: val.totalPaid,
        totalOwed: val.totalOwed,
        netBalance: val.totalPaid - val.totalOwed,
      });
    }
  });

  return entries.sort((a, b) => b.netBalance - a.netBalance);
}

/**
 * Simplify debts using a greedy algorithm.
 * Returns the minimum set of transactions to settle all debts.
 */
export function simplifyDebts(
  balances: BalanceEntry[]
): SimplifiedDebt[] {
  // Create mutable copy of net balances
  const debtors: { user: User; amount: number }[] = [];
  const creditors: { user: User; amount: number }[] = [];

  balances.forEach((b) => {
    if (b.netBalance < -0.01) {
      debtors.push({ user: b.user, amount: Math.abs(b.netBalance) });
    } else if (b.netBalance > 0.01) {
      creditors.push({ user: b.user, amount: b.netBalance });
    }
  });

  // Sort descending by amount
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements: SimplifiedDebt[] = [];

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const transfer = Math.min(debtors[i].amount, creditors[j].amount);

    if (transfer > 0.01) {
      settlements.push({
        from: debtors[i].user,
        to: creditors[j].user,
        amount: Math.round(transfer * 100) / 100,
      });
    }

    debtors[i].amount -= transfer;
    creditors[j].amount -= transfer;

    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return settlements;
}

/**
 * Split an expense equally among users.
 */
export function splitEqual(
  amount: number,
  userIds: string[]
): { user_id: string; amount_owed: number }[] {
  const perPerson = Math.round((amount / userIds.length) * 100) / 100;
  const remainder =
    Math.round((amount - perPerson * userIds.length) * 100) / 100;

  return userIds.map((id, idx) => ({
    user_id: id,
    amount_owed: idx === 0 ? perPerson + remainder : perPerson,
  }));
}

/**
 * Get total expenses for a trip.
 */
export function getTotalExpenses(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Get expenses grouped by category.
 */
export function getExpensesByCategory(
  expenses: Expense[]
): { category: string; total: number; count: number }[] {
  const map = new Map<string, { total: number; count: number }>();

  expenses.forEach((e) => {
    const existing = map.get(e.category) || { total: 0, count: 0 };
    existing.total += e.amount;
    existing.count += 1;
    map.set(e.category, existing);
  });

  return Array.from(map.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.total - a.total);
}
