
-- Dedicated Fix for Hour Rate Storage RLS
ALTER TABLE public.hour_rate_storage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workshop Isolation" ON public.hour_rate_storage;
CREATE POLICY "Workshop Isolation" ON public.hour_rate_storage 
FOR ALL USING (auth.uid() = workshop_id);

-- Ensure public access to read is also checked if needed, 
-- but usually "FOR ALL" with workshop_id is what we want for this app.
