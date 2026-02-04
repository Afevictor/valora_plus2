
-- ==========================================
-- VALUATION APPROVAL WORKFLOW - RLS FIX
-- ==========================================

-- This script ensures that administrators (users in workshop_auth)
-- can see and manage ALL valuations, regardless of which workshop sent them.

-- 1. DROP the restrictive generic policy if it exists specifically for valuations
DROP POLICY IF EXISTS "Workshop Isolation" ON public.valuations;

-- 2. CREATE a new multi-tenant policy for Valuations
-- This allows:
--  a) Workshops to see/edit their own data.
--  b) Admins (those in the whitelist) to see/edit EVERYTHING.
CREATE POLICY "Valuations Access Policy" ON public.valuations
FOR ALL
TO authenticated
USING (
    auth.uid() = workshop_id OR 
    EXISTS (
        SELECT 1 FROM public.workshop_auth 
        WHERE email = (auth.jwt() ->> 'email')
    )
);

-- 3. APPLY SIMILAR LOGIC TO ANONYMIZED VALUATIONS (for the queue preview)
DROP POLICY IF EXISTS "Workshop Isolation" ON public.anonymized_valuations;
CREATE POLICY "Anonymized Valuations Access Policy" ON public.anonymized_valuations
FOR ALL
TO authenticated
USING (
    auth.uid() = workshop_id OR 
    EXISTS (
        SELECT 1 FROM public.workshop_auth 
        WHERE email = (auth.jwt() ->> 'email')
    )
);

-- 4. ALLOW ADMINS TO VIEW ALL WORKSHOP PROFILES
-- Essential for seeing workshop details in the approval queue.
DROP POLICY IF EXISTS "Workshop profiles Isolation" ON public.company_profiles;
CREATE POLICY "Company Profiles Access Policy" ON public.company_profiles
FOR ALL
TO authenticated
USING (
    auth.uid() = id OR 
    EXISTS (
        SELECT 1 FROM public.workshop_auth 
        WHERE email = (auth.jwt() ->> 'email')
    )
);

-- 5. ALLOW ADMINS TO VIEW HOURLY RATE CALCULATIONS
-- Required to push correct costs to Bitrix based on the workshop's reference.
DROP POLICY IF EXISTS "Workshop Isolation" ON public.hour_rate_storage;
CREATE POLICY "Hour Rate Storage Access Policy" ON public.hour_rate_storage
FOR ALL
TO authenticated
USING (
    workshop_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.workshop_auth 
        WHERE email = (auth.jwt() ->> 'email')
    )
);

-- Note: This ensures the Admin Valuation Queue can actually fetch and process 
-- records submitted from any workshop in the system.
