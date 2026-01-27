-- Enable RLS on the table if not already enabled
ALTER TABLE public.client_activity_feed ENABLE ROW LEVEL SECURITY;

-- Policy to allow Workshop/Admin users to view ALL activity feed records (or restrict to their workshop_id)
-- For debugging purposes, we will allow authenticated users to view all records to confirm data visibility.
CREATE POLICY "Enable read access for authenticated users" 
ON public.client_activity_feed
FOR SELECT 
TO authenticated 
USING (true);

-- Policy to allow inserting activity
CREATE POLICY "Enable insert access for authenticated users" 
ON public.client_activity_feed
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Optional: If you want to restrict to specific workshop:
-- USING (workshop_id = auth.uid());
