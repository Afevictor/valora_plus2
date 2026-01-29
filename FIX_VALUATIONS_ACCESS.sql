-- ============================================
-- COMPLETE FIX FOR VALUATIONS ACCESS
-- ============================================

-- Step 1: Remove foreign key constraint (allows flexible workshop_id)
ALTER TABLE public.valuations 
DROP CONSTRAINT IF EXISTS valuations_workshop_id_fkey;

-- Step 2: Drop ALL existing policies
DROP POLICY IF EXISTS "Workshop Owner Access" ON public.valuations;
DROP POLICY IF EXISTS "Client Insert Access" ON public.valuations;
DROP POLICY IF EXISTS "Client Read Access" ON public.valuations;
DROP POLICY IF EXISTS "Workshop Delete Access" ON public.valuations;
DROP POLICY IF EXISTS "Workshop Update Access" ON public.valuations;
DROP POLICY IF EXISTS "Allow Delete for All Authenticated" ON public.valuations;
DROP POLICY IF EXISTS "Allow Insert for Authenticated" ON public.valuations;
DROP POLICY IF EXISTS "Allow Read All" ON public.valuations;
DROP POLICY IF EXISTS "Workshop Shared Access" ON public.valuations;
DROP POLICY IF EXISTS "Global Read Access" ON public.valuations;
DROP POLICY IF EXISTS "Allow All Operations" ON public.valuations;
DROP POLICY IF EXISTS "authenticated_all_access" ON public.valuations;

-- Step 3: Enable RLS
ALTER TABLE public.valuations ENABLE ROW LEVEL SECURITY;

-- Step 4: Create ONE simple policy that allows everything for authenticated users
CREATE POLICY "authenticated_all_access" ON public.valuations
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Step 5: Verify the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'valuations' 
ORDER BY ordinal_position;

-- Step 6: Show all records (for verification)
SELECT id, workshop_id, created_at 
FROM public.valuations 
ORDER BY created_at DESC 
LIMIT 10;
