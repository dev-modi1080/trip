-- TripSquad Database Schema
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    google_drive_refresh_token TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', 'User'),
        NEW.email,
        NEW.raw_user_meta_data ->> 'avatar_url'
    );
    RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. TRIPS
-- ============================================
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    destination TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    cover_image_url TEXT,
    created_by UUID REFERENCES profiles(id) NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    google_drive_folder_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. TRIP MEMBERS (many-to-many with roles)
-- ============================================
CREATE TABLE IF NOT EXISTS trip_members (
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (trip_id, user_id)
);

-- ============================================
-- 4. EXPENSES
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
    paid_by UUID REFERENCES profiles(id) NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    category TEXT CHECK (category IN ('food', 'transport', 'accommodation', 'activity', 'shopping', 'other')) DEFAULT 'other',
    split_type TEXT CHECK (split_type IN ('EQUAL', 'EXACT', 'PERCENT')) DEFAULT 'EQUAL',
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. EXPENSE SPLITS
-- ============================================
CREATE TABLE IF NOT EXISTS expense_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    amount_owed NUMERIC(12,2) NOT NULL CHECK (amount_owed >= 0),
    UNIQUE(expense_id, user_id)
);

-- ============================================
-- 6. SETTLEMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
    from_user UUID REFERENCES profiles(id) NOT NULL,
    to_user UUID REFERENCES profiles(id) NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    settled_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. ITINERARY ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS itinerary_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    category TEXT CHECK (category IN ('transport', 'activity', 'meal', 'accommodation', 'sightseeing')) DEFAULT 'activity',
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. TRIP PHOTOS
-- ============================================
CREATE TABLE IF NOT EXISTS trip_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
    uploaded_by UUID REFERENCES profiles(id) NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT,
    thumbnail_url TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('expense_added', 'settlement', 'trip_invite', 'itinerary_update', 'photo_added')),
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper functions for recursion-free policies
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

-- Drop existing policies if they exist to allow running this script multiple times
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Trip members can view trips" ON trips;
DROP POLICY IF EXISTS "Authenticated users can create trips" ON trips;
DROP POLICY IF EXISTS "Trip admins can update trips" ON trips;
DROP POLICY IF EXISTS "Trip admins can delete trips" ON trips;
DROP POLICY IF EXISTS "Anyone can look up trips by invite code" ON trips;
DROP POLICY IF EXISTS "Trip members can view other members" ON trip_members;
DROP POLICY IF EXISTS "Users can join trips" ON trip_members;
DROP POLICY IF EXISTS "Admins can remove members" ON trip_members;
DROP POLICY IF EXISTS "Trip members can view expenses" ON expenses;
DROP POLICY IF EXISTS "Trip members can create expenses" ON expenses;
DROP POLICY IF EXISTS "Expense creator can update" ON expenses;
DROP POLICY IF EXISTS "Expense creator or admin can delete" ON expenses;
DROP POLICY IF EXISTS "Trip members can view splits" ON expense_splits;
DROP POLICY IF EXISTS "Trip members can create splits" ON expense_splits;
DROP POLICY IF EXISTS "Split related user can delete" ON expense_splits;
DROP POLICY IF EXISTS "Trip members can view settlements" ON settlements;
DROP POLICY IF EXISTS "Trip members can create settlements" ON settlements;
DROP POLICY IF EXISTS "Trip members can view itinerary" ON itinerary_items;
DROP POLICY IF EXISTS "Trip members can create itinerary items" ON itinerary_items;
DROP POLICY IF EXISTS "Creator or admin can update itinerary" ON itinerary_items;
DROP POLICY IF EXISTS "Creator or admin can delete itinerary" ON itinerary_items;
DROP POLICY IF EXISTS "Trip members can view photos" ON trip_photos;
DROP POLICY IF EXISTS "Trip members can upload photos" ON trip_photos;
DROP POLICY IF EXISTS "Uploader can delete photos" ON trip_photos;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

-- PROFILES: Users can read all profiles, update their own, and insert their own (client-side auto-profile fallback)
CREATE POLICY "Profiles are viewable by authenticated users" ON profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- TRIPS
CREATE POLICY "Trip members can view trips" ON trips
    FOR SELECT TO authenticated
    USING (public.is_trip_member(id, auth.uid()));

CREATE POLICY "Authenticated users can create trips" ON trips
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Trip admins can update trips" ON trips
    FOR UPDATE TO authenticated
    USING (public.is_trip_admin(id, auth.uid()));

CREATE POLICY "Trip admins can delete trips" ON trips
    FOR DELETE TO authenticated
    USING (public.is_trip_admin(id, auth.uid()));

CREATE POLICY "Anyone can look up trips by invite code" ON trips
    FOR SELECT TO authenticated
    USING (true);

-- TRIP MEMBERS
CREATE POLICY "Trip members can view other members" ON trip_members
    FOR SELECT TO authenticated
    USING (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Users can join trips" ON trip_members
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can remove members" ON trip_members
    FOR DELETE TO authenticated
    USING (public.is_trip_admin(trip_id, auth.uid()) OR auth.uid() = user_id);

-- EXPENSES
CREATE POLICY "Trip members can view expenses" ON expenses
    FOR SELECT TO authenticated
    USING (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Trip members can create expenses" ON expenses
    FOR INSERT TO authenticated
    WITH CHECK (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Expense creator can update" ON expenses
    FOR UPDATE TO authenticated
    USING (auth.uid() = paid_by);

CREATE POLICY "Expense creator or admin can delete" ON expenses
    FOR DELETE TO authenticated
    USING (auth.uid() = paid_by OR public.is_trip_admin(trip_id, auth.uid()));

-- EXPENSE SPLITS
CREATE POLICY "Trip members can view splits" ON expense_splits
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM expenses e
            WHERE e.id = expense_splits.expense_id AND public.is_trip_member(e.trip_id, auth.uid())
        )
    );

CREATE POLICY "Trip members can create splits" ON expense_splits
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM expenses e
            WHERE e.id = expense_splits.expense_id AND public.is_trip_member(e.trip_id, auth.uid())
        )
    );

CREATE POLICY "Split related user can delete" ON expense_splits
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM expenses e
            WHERE e.id = expense_splits.expense_id AND public.is_trip_member(e.trip_id, auth.uid())
        )
    );

-- SETTLEMENTS
CREATE POLICY "Trip members can view settlements" ON settlements
    FOR SELECT TO authenticated
    USING (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Trip members can create settlements" ON settlements
    FOR INSERT TO authenticated
    WITH CHECK (public.is_trip_member(trip_id, auth.uid()));

-- ITINERARY ITEMS
CREATE POLICY "Trip members can view itinerary" ON itinerary_items
    FOR SELECT TO authenticated
    USING (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Trip members can create itinerary items" ON itinerary_items
    FOR INSERT TO authenticated
    WITH CHECK (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Creator or admin can update itinerary" ON itinerary_items
    FOR UPDATE TO authenticated
    USING (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Creator or admin can delete itinerary" ON itinerary_items
    FOR DELETE TO authenticated
    USING (public.is_trip_member(trip_id, auth.uid()));

-- TRIP PHOTOS
CREATE POLICY "Trip members can view photos" ON trip_photos
    FOR SELECT TO authenticated
    USING (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Trip members can upload photos" ON trip_photos
    FOR INSERT TO authenticated
    WITH CHECK (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Uploader can delete photos" ON trip_photos
    FOR DELETE TO authenticated
    USING (auth.uid() = uploaded_by OR public.is_trip_admin(trip_id, auth.uid()));

-- NOTIFICATIONS
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create notifications" ON notifications
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON trip_members(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_user_id ON expense_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_settlements_trip_id ON settlements(trip_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_items_trip_id ON itinerary_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_photos_trip_id ON trip_photos(trip_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_invite_code ON trips(invite_code);

-- ============================================
-- STORAGE BUCKET for trip photos
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('trip-photos', 'trip-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Authenticated users can upload trip photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view trip photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own uploaded photos" ON storage.objects;

CREATE POLICY "Authenticated users can upload trip photos" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'trip-photos');

CREATE POLICY "Anyone can view trip photos" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'trip-photos');

CREATE POLICY "Users can delete own uploaded photos" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'trip-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
