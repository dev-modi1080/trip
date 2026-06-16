-- Add is_paid column to expense_splits table
ALTER TABLE public.expense_splits 
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;

-- Add RLS policy to allow trip members to update splits (so they can mark them as paid/unpaid)
DROP POLICY IF EXISTS "Trip members can update splits" ON public.expense_splits;

CREATE POLICY "Trip members can update splits" ON public.expense_splits
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.expenses e
            WHERE e.id = expense_splits.expense_id AND public.is_trip_member(e.trip_id, auth.uid())
        )
    );
