-- ==========================================
-- FINAL CRM & TALLER ISOLATION FIX
-- ==========================================

-- 1. Ensure CRM Tables have the correct structure
DO $$ 
BEGIN
    -- Fix quotes table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'updated_at') THEN
        ALTER TABLE public.quotes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'workshop_id') THEN
        ALTER TABLE public.quotes ADD COLUMN workshop_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Fix opportunities table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'updated_at') THEN
        ALTER TABLE public.opportunities ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'workshop_id') THEN
        ALTER TABLE public.opportunities ADD COLUMN workshop_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Create helper tables if missing
CREATE TABLE IF NOT EXISTS public.analysis_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    valuation_id UUID,
    file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.valuation_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    valuation_id UUID,
    message TEXT,
    sender_role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bitrix_settings (
    workshop_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    webhook_url TEXT,
    default_expert_id TEXT,
    default_expert_name TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS on ALL public tables
DO $$ 
DECLARE 
    t text;
BEGIN 
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' 
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    END LOOP;
END $$;

-- 4. Apply Global Workshop Isolation Policy
-- This policy ensures that for any table with a 'workshop_id' column, 
-- users can only see/edit their own workshop's data.
DO $$ 
DECLARE 
    t text;
BEGIN 
    FOR t IN SELECT table_name FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name IN (
                 SELECT table_name FROM information_schema.columns 
                 WHERE column_name = 'workshop_id'
             )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Workshop Isolation" ON public.%I;', t);
        EXECUTE format('CREATE POLICY "Workshop Isolation" ON public.%I FOR ALL TO authenticated USING (auth.uid() = workshop_id) WITH CHECK (auth.uid() = workshop_id);', t);
    END LOOP;
END $$;

-- 5. Special Case for Company Profiles (where PK id is the workshop_id)
DROP POLICY IF EXISTS "Workshop profiles Isolation" ON public.company_profiles;
CREATE POLICY "Workshop profiles Isolation" ON public.company_profiles 
FOR ALL TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 6. Special Case for Clients Table
-- Workshops see records where workshop_id = their UID
-- BUT if a client logs in (using their own ID), they should see their own record.
DROP POLICY IF EXISTS "Taller sees own profile" ON public.clients;
CREATE POLICY "Taller sees own profile" ON public.clients 
FOR SELECT TO authenticated 
USING (auth.uid() = id);

-- 7. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_quotes_updated_at ON public.quotes;
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_opportunities_updated_at ON public.opportunities;
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_bitrix_settings_updated_at ON public.bitrix_settings;
CREATE TRIGGER update_bitrix_settings_updated_at BEFORE UPDATE ON public.bitrix_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 8. Final Permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Confirmation Log
COMMENT ON TABLE public.quotes IS 'CRM Quotes with Workshop Isolation';
COMMENT ON TABLE public.opportunities IS 'CRM Opportunities with Workshop Isolation';
