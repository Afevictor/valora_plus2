-- ==========================================
-- CRM & TALLER AREA - PERSISTENCE & ISOLATION FIX
-- ==========================================

-- 1. Create CRM Tables if not exists (Quotes & Opportunities)
CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.opportunities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure Row Level Security is Enabled
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 3. Isolation Policies for "Taller" (Workshop Users)
-- Note: In this deployment, the 'Client' role represents individual Talleres/Workshops
-- using the Client Area/Portal del Taller. Their authentication UID must match the workshop_id.

DROP POLICY IF EXISTS "Workshop Isolation" ON public.quotes;
CREATE POLICY "Workshop Isolation" ON public.quotes 
FOR ALL TO authenticated 
USING (auth.uid() = workshop_id)
WITH CHECK (auth.uid() = workshop_id);

DROP POLICY IF EXISTS "Workshop Isolation" ON public.opportunities;
CREATE POLICY "Workshop Isolation" ON public.opportunities 
FOR ALL TO authenticated 
USING (auth.uid() = workshop_id)
WITH CHECK (auth.uid() = workshop_id);

-- 4. Fix Client Table Policy
-- Talleres (Client role) need to see their own customer list to manage CRM
DROP POLICY IF EXISTS "Workshop Isolation" ON public.clients;
CREATE POLICY "Workshop Isolation" ON public.clients 
FOR ALL TO authenticated 
USING (auth.uid() = workshop_id)
WITH CHECK (auth.uid() = workshop_id);

-- Add a fallback for the Taller to see their own profile in the clients table 
-- (Sometimes their own record is in the clients table with auth.uid() = id)
DROP POLICY IF EXISTS "Taller sees own profile" ON public.clients;
CREATE POLICY "Taller sees own profile" ON public.clients 
FOR SELECT TO authenticated 
USING (auth.uid() = id);

-- 5. Ensure updated_at triggers exist for CRM tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_quotes_updated_at ON public.quotes;
CREATE TRIGGER update_quotes_updated_at
    BEFORE UPDATE ON public.quotes
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_opportunities_updated_at ON public.opportunities;
CREATE TRIGGER update_opportunities_updated_at
    BEFORE UPDATE ON public.opportunities
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 6. Grant Permissions (just in case they were revoked)
GRANT ALL ON public.quotes TO authenticated;
GRANT ALL ON public.opportunities TO authenticated;
GRANT ALL ON public.clients TO authenticated;
GRANT ALL ON public.valuations TO authenticated;


-- 7. Optional: Ensure work_orders and vehicles also have the isolation policy 
-- to support the "Taller" role using the Kanban and Vehicle Management
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workshop Isolation" ON public.work_orders;
CREATE POLICY "Workshop Isolation" ON public.work_orders 
FOR ALL TO authenticated 
USING (auth.uid() = workshop_id)
WITH CHECK (auth.uid() = workshop_id);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workshop Isolation" ON public.vehicles;
CREATE POLICY "Workshop Isolation" ON public.vehicles 
FOR ALL TO authenticated 
USING (auth.uid() = workshop_id)
WITH CHECK (auth.uid() = workshop_id);
