'use client';

import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';

export async function notifyExpenseAdded(
  tripId: string,
  payerName: string,
  amount: number,
  description: string,
  memberIds: string[],
  excludeUserId: string
) {
  const supabase = createClient();
  const notifyList = memberIds.filter((id) => id !== excludeUserId);
  if (notifyList.length === 0) return;

  const inserts = notifyList.map((userId) => ({
    user_id: userId,
    trip_id: tripId,
    type: 'expense_added' as const,
    title: 'New Expense Added',
    message: `${payerName} added "${description}" for ${formatCurrency(amount)}`,
  }));

  const { error } = await supabase.from('notifications').insert(inserts);
  if (error) {
    console.error('Error inserting expense notifications:', error);
  }
}

export async function notifySettlement(
  tripId: string,
  fromName: string,
  toUserId: string,
  amount: number
) {
  const supabase = createClient();
  const { error } = await supabase.from('notifications').insert({
    user_id: toUserId,
    trip_id: tripId,
    type: 'settlement' as const,
    title: 'Payment Received',
    message: `${fromName} sent you a settlement payment of ${formatCurrency(amount)}`,
  });
  if (error) {
    console.error('Error inserting settlement notification:', error);
  }
}

export async function notifyMemberJoined(
  tripId: string,
  newMemberName: string,
  memberIds: string[],
  excludeUserId: string
) {
  const supabase = createClient();
  const notifyList = memberIds.filter((id) => id !== excludeUserId);
  if (notifyList.length === 0) return;

  const inserts = notifyList.map((userId) => ({
    user_id: userId,
    trip_id: tripId,
    type: 'trip_invite' as const,
    title: 'New Member Joined',
    message: `${newMemberName} has joined the trip`,
  }));

  const { error } = await supabase.from('notifications').insert(inserts);
  if (error) {
    console.error('Error inserting member joined notifications:', error);
  }
}

export async function notifyItineraryUpdate(
  tripId: string,
  updaterName: string,
  itemTitle: string,
  memberIds: string[],
  excludeUserId: string
) {
  const supabase = createClient();
  const notifyList = memberIds.filter((id) => id !== excludeUserId);
  if (notifyList.length === 0) return;

  const inserts = notifyList.map((userId) => ({
    user_id: userId,
    trip_id: tripId,
    type: 'itinerary_update' as const,
    title: 'Itinerary Updated',
    message: `${updaterName} updated the itinerary: "${itemTitle}"`,
  }));

  const { error } = await supabase.from('notifications').insert(inserts);
  if (error) {
    console.error('Error inserting itinerary notifications:', error);
  }
}
