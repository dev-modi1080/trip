-- TripSquad RLS Recursion Fix Script
-- Run this script in your Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- ==========================================================
-- 1. Create helper functions (SECURITY DEFINER to bypass RLS)
-- ==========================================================

CREATE OR REPLACE FUNCTION public.is_trip_member(trip_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.trip_members 
        WHERE public.trip_members.trip_id = $1 
          AND public.trip_members.user_id = $2
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_trip_admin(trip_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.trip_members 
        WHERE public.trip_members.trip_id = $1 
          AND public.trip_members.user_id = $2
          AND public.trip_members.role = 'admin'
    );
END;
$$;

-- ==========================================================
-- 2. Drop existing recursive policies to avoid conflicts
-- ==========================================================

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Trip members can view trips" ON public.trips;
DROP POLICY IF EXISTS "Trip admins can update trips" ON public.trips;
DROP POLICY IF EXISTS "Trip admins can delete trips" ON public.trips;
DROP POLICY IF EXISTS "Trip members can view other members" ON public.trip_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.trip_members;
DROP POLICY IF EXISTS "Trip members can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Trip members can create expenses" ON public.expenses;
DROP POLICY IF EXISTS "Expense creator or admin can delete" ON public.expenses;
DROP POLICY IF EXISTS "Trip members can view splits" ON public.expense_splits;
DROP POLICY IF EXISTS "Trip members can create splits" ON public.expense_splits;
DROP POLICY IF EXISTS "Split related user can delete" ON public.expense_splits;
DROP POLICY IF EXISTS "Trip members can view settlements" ON public.settlements;
DROP POLICY IF EXISTS "Trip members can create settlements" ON public.settlements;
DROP POLICY IF EXISTS "Trip members can view itinerary" ON public.itinerary_items;
DROP POLICY IF EXISTS "Trip members can create itinerary items" ON public.itinerary_items;
DROP POLICY IF EXISTS "Trip members can update itinerary items" ON public.itinerary_items;
DROP POLICY IF EXISTS "Trip members can delete itinerary items" ON public.itinerary_items;
DROP POLICY IF EXISTS "Trip members can view photos" ON public.trip_photos;
DROP POLICY IF EXISTS "Trip members can upload photos" ON public.trip_photos;
DROP POLICY IF EXISTS "Photo owner or admin can delete photos" ON public.trip_photos;
DROP POLICY IF EXISTS "Authenticated users can upload trip photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view trip photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own uploaded photos" ON storage.objects;

-- ==========================================================
-- 3. Recreate policies utilizing the recursion-free helpers
-- ==========================================================

-- PROFILES
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- TRIPS
CREATE POLICY "Trip members can view trips" ON public.trips
    FOR SELECT TO authenticated
    USING (public.is_trip_member(id, auth.uid()));

CREATE POLICY "Trip admins can update trips" ON public.trips
    FOR UPDATE TO authenticated
    USING (public.is_trip_admin(id, auth.uid()));

CREATE POLICY "Trip admins can delete trips" ON public.trips
    FOR DELETE TO authenticated
    USING (public.is_trip_admin(id, auth.uid()));

-- TRIP MEMBERS
CREATE POLICY "Trip members can view other members" ON public.trip_members
    FOR SELECT TO authenticated
    USING (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Admins can remove members" ON public.trip_members
    FOR DELETE TO authenticated
    USING (public.is_trip_admin(trip_id, auth.uid()) OR auth.uid() = user_id);

-- EXPENSES
CREATE POLICY "Trip members can view expenses" ON public.expenses
    FOR SELECT TO authenticated
    USING (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Trip members can create expenses" ON public.expenses
    FOR INSERT TO authenticated
    WITH CHECK (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Expense creator or admin can delete" ON public.expenses
    FOR DELETE TO authenticated
    USING (auth.uid() = paid_by OR public.is_trip_admin(trip_id, auth.uid()));

-- EXPENSE SPLITS
CREATE POLICY "Trip members can view splits" ON public.expense_splits
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.expenses e
            WHERE e.id = expense_splits.expense_id AND public.is_trip_member(e.trip_id, auth.uid())
        )
    );

CREATE POLICY "Trip members can create splits" ON public.expense_splits
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.expenses e
            WHERE e.id = expense_splits.expense_id AND public.is_trip_member(e.trip_id, auth.uid())
        )
    );

CREATE POLICY "Split related user can delete" ON public.expense_splits
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.expenses e
            WHERE e.id = expense_splits.expense_id AND public.is_trip_member(e.trip_id, auth.uid())
        )
    );

-- SETTLEMENTS
CREATE POLICY "Trip members can view settlements" ON public.settlements
    FOR SELECT TO authenticated
    USING (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Trip members can create settlements" ON public.settlements
    FOR INSERT TO authenticated
    WITH CHECK (public.is_trip_member(trip_id, auth.uid()));

-- ITINERARY ITEMS
CREATE POLICY "Trip members can view itinerary" ON public.itinerary_items
    FOR SELECT TO authenticated
    USING (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Trip members can create itinerary items" ON public.itinerary_items
    FOR INSERT TO authenticated
    WITH CHECK (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Trip members can update itinerary items" ON public.itinerary_items
    FOR UPDATE TO authenticated
    USING (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Trip members can delete itinerary items" ON public.itinerary_items
    FOR DELETE TO authenticated
    USING (public.is_trip_member(trip_id, auth.uid()));

-- TRIP PHOTOS
CREATE POLICY "Trip members can view photos" ON public.trip_photos
    FOR SELECT TO authenticated
    USING (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Trip members can upload photos" ON public.trip_photos
    FOR INSERT TO authenticated
    WITH CHECK (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Photo owner or admin can delete photos" ON public.trip_photos
    FOR DELETE TO authenticated
    USING (auth.uid() = uploaded_by OR public.is_trip_admin(trip_id, auth.uid()));

-- STORAGE POLICIES
CREATE POLICY "Authenticated users can upload trip photos" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'trip-photos');

CREATE POLICY "Anyone can view trip photos" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'trip-photos');

CREATE POLICY "Users can delete own uploaded photos" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'trip-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ==========================================================
-- 4. Migrations: Add Google Drive columns if missing
-- ==========================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS google_drive_refresh_token TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT;

-- ==========================================================
-- 5. Manual profile sync (Create profiles for any existing user)
-- ==========================================================

INSERT INTO public.profiles (id, full_name, email, avatar_url)
SELECT 
    id, 
    COALESCE(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', 'User'),
    email,
    raw_user_meta_data ->> 'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
