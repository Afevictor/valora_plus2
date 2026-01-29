
-- ========================================================
-- BITRIX24 INTEGRATION - DEFINITIVE FIX (v2)
-- ========================================================

-- 1. Ensure columns exist in company_profiles
ALTER TABLE public.company_profiles 
ADD COLUMN IF NOT EXISTS bitrix_webhook_url text,
ADD COLUMN IF NOT EXISTS default_expert_id text,
ADD COLUMN IF NOT EXISTS default_expert_name text;

-- 2. Fix RLS for company_profiles (Permissive Select)
-- This allows clients to read the Bitrix configuration of their workshop
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile Public Read" ON public.company_profiles;
CREATE POLICY "Profile Public Read" ON public.company_profiles 
FOR SELECT TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Profile Owner Manage" ON public.company_profiles;
CREATE POLICY "Profile Owner Manage" ON public.company_profiles 
FOR ALL TO authenticated 
USING (auth.uid() = id);

-- 3. Ensure a profile exists for existing users (Migration)
INSERT INTO public.company_profiles (id, company_name)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Verification query (Run separately if you want to check)
-- SELECT id, company_name, bitrix_webhook_url FROM public.company_profiles;
