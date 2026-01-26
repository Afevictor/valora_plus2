-- ========================================================
-- DEFINITIVE CLIENT VISIBILITY & STORAGE FIX (V5 - PERMISSIVE DEBUG)
-- ========================================================

-- 1. CLEANUP ALL POLICIES
DO $$ 
DECLARE 
    t text;
    r RECORD;
BEGIN 
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' 
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = t AND schemaname = 'public') LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, t);
        END LOOP;
    END LOOP;
END $$;

-- 2. WORK ORDERS:
CREATE POLICY "Admin Work Order Access" ON public.work_orders FOR ALL TO authenticated USING (auth.uid() = workshop_id);
CREATE POLICY "Client Work Order Select" ON public.work_orders FOR SELECT TO authenticated USING (client_id = auth.uid()::text);
CREATE POLICY "Client Work Order Insert" ON public.work_orders FOR INSERT TO authenticated WITH CHECK (true); -- Allow clients to submit any order

-- 3. WORKSHOP FILES (Metadata):
-- Permissive SELECT for debugging: anyone authenticated can see metadata
CREATE POLICY "Files Permissive Select" ON public.workshop_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Files Workshop Manage" ON public.workshop_files FOR ALL TO authenticated USING (auth.uid() = workshop_id);
CREATE POLICY "Files Client Insert" ON public.workshop_files FOR INSERT TO authenticated WITH CHECK (true); -- Allow clients to upload metadata

-- 4. VEHICLES:
CREATE POLICY "Vehicle Permissive Access" ON public.vehicles FOR ALL TO authenticated USING (true);

-- 5. CLIENTS:
CREATE POLICY "Client Permissive Access" ON public.clients FOR ALL TO authenticated USING (true);

-- 6. COMPANY PROFILE:
CREATE POLICY "Profile Public Read" ON public.company_profile FOR SELECT TO authenticated USING (true);
CREATE POLICY "Profile Owner Manage" ON public.company_profile FOR ALL TO authenticated USING (auth.uid() = workshop_id);

-- 7. STORAGE POLICIES:
-- Ultra-permissive for testing 'reception-files'
DROP POLICY IF EXISTS "Global Storage Access" ON storage.objects;
CREATE POLICY "Global Storage Access" ON storage.objects 
FOR ALL TO authenticated 
USING (
    bucket_id IN ('videos', 'evidence_photos', 'documents', 'attachments', 'appraisal-files', 'reception-files')
)
WITH CHECK (
    bucket_id IN ('videos', 'evidence_photos', 'documents', 'attachments', 'appraisal-files', 'reception-files')
);





