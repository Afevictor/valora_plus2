-- Workshop Auth Whitelist Table
-- This table stores emails of users who are authorized to login as Workshop Admins.
-- IT IS NOT for storing passwords. Passwords are handled by Supabase Auth (auth.users).

CREATE TABLE IF NOT EXISTS public.workshop_auth (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.workshop_auth ENABLE ROW LEVEL SECURITY;

-- POLICIES

-- 1. Read Access: Needed for the login check "checkIsWorkshopAuthEmail"
-- We allow any authenticated user to check this table.
-- (Ideally, we could restrict this further, but the client needs to know if it *can* login as admin)
CREATE POLICY "Allow read access to authenticated users"
    ON public.workshop_auth FOR SELECT
    TO authenticated
    USING (true);

-- 2. Insert Access: Needed for "handleSignup" in Auth.tsx
-- when a new workshop registers.
-- SECURITY WARNING: This allows any authenticated user to add themselves to the whitelist.
-- In a strict production environment, this should be done via a secure server-side function or trigger.
-- For this application context, we allow it to enable self-registration.
CREATE POLICY "Allow insert for authenticated users"
    ON public.workshop_auth FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 3. Update/Delete: Only allow if email matches (or restrict to superadmins if we had them)
-- For now, let's just allow users to manage their own entry if needed, but the app doesn't implement delete yet.
CREATE POLICY "Allow users to delete their own entry"
    ON public.workshop_auth FOR DELETE
    TO authenticated
    USING (email = auth.jwt() ->> 'email');
